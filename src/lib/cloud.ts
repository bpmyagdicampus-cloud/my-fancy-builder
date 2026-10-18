import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cloudApply, cloudRemove, emptyData, exportProfile, getDB, replaceData, setAfterMutate, type Profile } from "@/lib/store";
import { toEmail, type Role } from "@/lib/login";

// The generated Supabase types do not know the new columns yet, so we talk to it untyped.
const sb = supabase as any;

export type MyProfile = Profile & { username: string | null; avatar_path: string | null; bg: string | null };
export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";
export type CloudState = {
  status: "loading" | "anon" | "ready";
  userId: string | null; email: string | null; roles: Role[]; me: MyProfile | null;
  /** whose diary is open (own id, or a teacher's id when an admin is viewing) */
  activeId: string | null; cloudIds: string[];
  save: SaveState; saveMsg: string; localMode: boolean;
};

const LOCAL_KEY = "shikshak-local-mode";
const INITIAL: CloudState = { status: "loading", userId: null, email: null, roles: [], me: null, activeId: null, cloudIds: [], save: "idle", saveMsg: "", localMode: false };
let state: CloudState = INITIAL;
const subs = new Set<() => void>();
const set = (p: Partial<CloudState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useCloud = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => INITIAL);
export const isStaff = (r: Role[]) => r.includes("teacher") || r.includes("admin");

const versions: Record<string, number> = {};
const lastProf: Record<string, string> = {};
const cloudIds = new Set<string>();
const pk = (id: string) => `shikshak-cloud-pending-${id}`;
const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as any).message) : String(e));

const toMe = (p: any): MyProfile => ({
  id: p.id, name: p.name ?? "", designation: p.designation ?? "", dept: p.dept ?? "", campus: p.campus ?? "", address: p.address ?? "",
  hod: p.hod ?? "", chief: p.chief ?? "", username: p.username ?? null, avatar_path: p.avatar_path ?? null, bg: p.bg ?? null,
});
const toProfile = (p: any): Profile => { const { id, name, designation, dept, campus, address, hod, chief } = toMe(p); return { id, name, designation, dept, campus, address, hod, chief }; };
const profFields = (p: Profile) => ({ name: p.name, designation: p.designation, dept: p.dept, campus: p.campus, address: p.address, hod: p.hod, chief: p.chief });

// ---------- sign in / out ----------
let inited = false;
let booting: string | null = null;

export function initAuth() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  let local = false;
  try { local = localStorage.getItem(LOCAL_KEY) === "1"; } catch { /* ignore */ }
  set({ localMode: local });
  setAfterMutate(schedule);
  sb.auth.onAuthStateChange((_e: string, session: any) => { setTimeout(() => void handleSession(session?.user ?? null), 0); });
  sb.auth.getSession().then(({ data }: any) => void handleSession(data?.session?.user ?? null)).catch(() => void handleSession(null));
  window.addEventListener("online", () => { if (dirty) void flush(); });
  window.addEventListener("beforeunload", (e) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ""; } });
}

async function handleSession(user: any) {
  if (!user) {
    if (state.status !== "anon") { cloudRemove([...cloudIds]); cloudIds.clear(); set({ status: "anon", userId: null, email: null, roles: [], me: null, activeId: null, cloudIds: [], save: "idle", saveMsg: "" }); }
    return;
  }
  if (state.userId === user.id && state.status === "ready") return;
  if (booting === user.id) return;
  booting = user.id;
  try {
    const [r, p] = await Promise.all([sb.from("user_roles").select("role").eq("user_id", user.id), sb.from("profiles").select("*").eq("id", user.id).maybeSingle()]);
    if (r.error || p.error) throw new Error(errMsg(r.error || p.error));
    const roles = (r.data ?? []).map((x: any) => x.role) as Role[];
    const me = p.data ? toMe(p.data) : null;
    if (me && isStaff(roles)) await loadTeacher(user.id);
    set({ status: "ready", userId: user.id, email: user.email ?? null, roles, me, saveMsg: "" });
  } catch (e) {
    set({ status: "ready", userId: user.id, email: user.email ?? null, roles: [], me: null, saveMsg: errMsg(e) });
  } finally { booting = null; }
}

export async function signIn(login: string, password: string): Promise<string | null> {
  const { error } = await sb.auth.signInWithPassword({ email: toEmail(login), password });
  if (!error) return null;
  return /invalid login/i.test(error.message) ? "ID वा पासवर्ड मिलेन। / Wrong ID or password." : error.message;
}

export async function signOut(): Promise<boolean> {
  while (saving) await new Promise((r) => setTimeout(r, 100));
  if (dirty || state.save === "error" || state.save === "conflict") {
    const ok = await flush();
    if (!ok && !confirm("Some changes are NOT saved to the cloud yet. Sign out anyway? Those changes will be lost.")) return false;
  }
  for (const id of cloudIds) { try { localStorage.removeItem(pk(id)); } catch { /* ignore */ } }
  cloudRemove([...cloudIds]); cloudIds.clear(); dirty = false;
  set({ status: "anon", userId: null, email: null, roles: [], me: null, activeId: null, cloudIds: [], save: "idle", saveMsg: "" });
  await sb.auth.signOut();
  return true;
}

export function enterLocalMode() { try { localStorage.setItem(LOCAL_KEY, "1"); } catch { /* ignore */ } set({ localMode: true }); }
export function leaveLocalMode() { try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ } set({ localMode: false }); }

// ---------- loading a diary from the cloud ----------
async function loadTeacher(id: string) {
  const [p, t] = await Promise.all([
    sb.from("profiles").select("*").eq("id", id).maybeSingle(),
    sb.from("teacher_data").select("content,version").eq("teacher_id", id).maybeSingle(),
  ]);
  if (p.error || t.error) throw new Error(errMsg(p.error || t.error));
  if (!p.data) throw new Error("Profile not found");
  if (!t.data) await sb.from("teacher_data").insert({ teacher_id: id }); // first time; ignore errors
  const prof = toProfile(p.data);
  const cloudVersion: number = t.data?.version ?? 0;
  let pending: string | null = null;
  try { pending = localStorage.getItem(pk(id)); } catch { /* ignore */ }
  const hasLocal = !!getDB().data[id];

  versions[id] = cloudVersion;
  lastProf[id] = JSON.stringify(profFields(prof));
  cloudIds.add(id);

  if (pending !== null && hasLocal) {
    // This device has changes that were never saved to the cloud: never overwrite them silently.
    cloudApply(id, prof, t.data?.content ?? {}, true);
    set({ activeId: id, cloudIds: [...cloudIds] });
    if (Number(pending) === cloudVersion) { dirty = true; void flush(); }
    else set({ save: "conflict", saveMsg: "This device has unsaved changes, but the cloud copy was changed from elsewhere." });
    return;
  }
  cloudApply(id, prof, t.data?.content ?? {});
  set({ activeId: id, cloudIds: [...cloudIds], save: "idle", saveMsg: "" });
}

/** Admin: open another teacher's diary (or go back to own with openTeacher(ownId)). */
export async function openTeacher(id: string) {
  if (dirty || saving) await flush();
  await loadTeacher(id);
}

// ---------- saving ----------
let timer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let saving = false;

function schedule() {
  const id = state.activeId;
  if (!id || state.status === "anon" || getDB().current !== id || state.save === "conflict") return;
  try { if (localStorage.getItem(pk(id)) === null) localStorage.setItem(pk(id), String(versions[id] ?? 0)); } catch { /* ignore */ }
  dirty = true;
  if (!saving) set({ save: "dirty" });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 1200);
}

export async function flush(): Promise<boolean> {
  if (timer) { clearTimeout(timer); timer = null; }
  const id = state.activeId;
  if (!id || !dirty) return true;
  if (saving) return false;
  saving = true; dirty = false;
  set({ save: "saving" });
  try {
    const db = getDB();
    const content = db.data[id] ?? emptyData();
    const prof = db.profiles.find((p) => p.id === id);
    const v = versions[id] ?? 0;
    const { data, error } = await sb.from("teacher_data").update({ content, version: v + 1, updated_at: new Date().toISOString() }).eq("teacher_id", id).eq("version", v).select("version");
    if (error) throw error;
    if (!data || data.length === 0) { dirty = true; set({ save: "conflict", saveMsg: "The cloud copy was changed from another device or browser." }); return false; }
    versions[id] = v + 1;
    if (prof) {
      const f = profFields(prof); const j = JSON.stringify(f);
      if (j !== lastProf[id]) { const r = await sb.from("profiles").update(f).eq("id", id); if (r.error) throw r.error; lastProf[id] = j; }
    }
    if (dirty) timer = setTimeout(() => void flush(), 300);
    else { try { localStorage.removeItem(pk(id)); } catch { /* ignore */ } set({ save: "saved", saveMsg: "" }); }
    return true;
  } catch (e) {
    dirty = true;
    set({ save: "error", saveMsg: errMsg(e) });
    timer = setTimeout(() => void flush(), 15000);
    return false;
  } finally { saving = false; }
}

function downloadText(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name; a.click();
}

/** Resolve a save conflict: keep this device's copy (overwrites cloud) or take the cloud copy (this device's copy is downloaded first). */
export async function resolveConflict(mode: "keep-mine" | "use-cloud") {
  const id = state.activeId; if (!id) return;
  const t = await sb.from("teacher_data").select("version,content").eq("teacher_id", id).maybeSingle();
  if (t.error) { set({ saveMsg: errMsg(t.error) }); return; }
  if (mode === "keep-mine") {
    versions[id] = t.data?.version ?? 0;
    dirty = true; set({ save: "dirty", saveMsg: "" }); await flush();
  } else {
    try { downloadText(`diary-unsaved-copy-${Date.now()}.json`, exportProfile(id)); } catch { /* ignore */ }
    try { localStorage.removeItem(pk(id)); } catch { /* ignore */ }
    dirty = false;
    await loadTeacher(id);
  }
}

// ---------- account helpers ----------
export async function changePassword(pw: string): Promise<string | null> {
  const { error } = await sb.auth.updateUser({ password: pw });
  return error ? error.message : null;
}
export async function updateMine(patch: Partial<Pick<MyProfile, "avatar_path" | "bg">>): Promise<string | null> {
  if (!state.userId) return "Not signed in";
  const { error } = await sb.from("profiles").update(patch).eq("id", state.userId);
  if (error) return error.message;
  if (state.me) set({ me: { ...state.me, ...patch } });
  return null;
}
export async function uploadImage(kind: "avatar" | "bg", blob: Blob): Promise<string | null> {
  const uid = state.userId; if (!uid) return "Not signed in";
  const old = kind === "avatar" ? state.me?.avatar_path : (state.me?.bg ?? "").startsWith("image:") ? state.me!.bg!.slice(6) : null;
  const path = `${uid}/${kind}-${Date.now()}.jpg`;
  const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (up.error) return up.error.message;
  const err = await updateMine(kind === "avatar" ? { avatar_path: path } : { bg: `image:${path}` });
  if (err) return err;
  if (old) void sb.storage.from("avatars").remove([old]);
  return null;
}

const urlCache = new Map<string, { url: string; exp: number }>();
export async function signedUrl(path: string): Promise<string | null> {
  const c = urlCache.get(path);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await sb.storage.from("avatars").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
export function useSignedUrl(path?: string | null) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => {
    let on = true; setU(null);
    if (path) void signedUrl(path).then((x) => { if (on) setU(x); });
    return () => { on = false; };
  }, [path]);
  return u;
}

/** Copy an old on-device profile into the signed-in account (the old copy stays on the device as a backup). */
export function importLocalToCloud(localId: string): string | null {
  const id = state.userId;
  if (!id || state.activeId !== id) return "Open your own diary first.";
  const db = getDB();
  const lp = db.profiles.find((p) => p.id === localId);
  if (!lp) return "Profile not found.";
  const { designation, dept, campus, address, hod, chief } = lp;
  replaceData(id, db.data[localId] ?? emptyData(), { designation, dept, campus, address, hod, chief });
  return null;
}
