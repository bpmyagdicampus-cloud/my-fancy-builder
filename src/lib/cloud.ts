import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cloudApply, cloudRemove, emptyData, exportProfile, getDB, mutate, replaceData, setAfterMutate, type Profile } from "@/lib/store";
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
  /** set when the diary could not be loaded from the cloud; the app stays locked instead of showing empty data */
  loadError: string;
  /** academic year chosen by the administrator (null when none is set or the feature is not installed yet) */
  activeYear: { id: string; name: string } | null;
  yearList: YearRow[];
  yearsReady: boolean;
};
export type YearRow = { id: string; name: string; is_active: boolean };

const LOCAL_KEY = "shikshak-local-mode";
const INITIAL: CloudState = { status: "loading", userId: null, email: null, roles: [], me: null, activeId: null, cloudIds: [], save: "idle", saveMsg: "", localMode: false, loadError: "", activeYear: null, yearList: [], yearsReady: false };
let state: CloudState = INITIAL;
const subs = new Set<() => void>();
const set = (p: Partial<CloudState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useCloud = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => INITIAL);
export const getCloudState = () => state;
export const isStaff = (r: Role[]) => r.includes("teacher") || r.includes("admin");

const versions: Record<string, number> = {};
const lastProf: Record<string, string> = {};
const cloudIds = new Set<string>();
const pk = (id: string) => `shikshak-cloud-pending-${id}`;
const errMsg = (e: unknown) => (e && typeof e === "object" && "message" in e ? String((e as any).message) : String(e));

const isNetworkError = (e: unknown) => /fetch|network|offline|timeout|timed out/i.test(errMsg(e));
// Small cache so the app can still open (from this device's copy) when the connection is down.
type Cache = { roles: Role[]; me: MyProfile | null; version: number };
const ck = (id: string) => `shikshak-cloud-cache-${id}`;
const readCache = (id: string): Cache | null => { try { const t = localStorage.getItem(ck(id)); return t ? JSON.parse(t) : null; } catch { return null; } };
const writeCache = (id: string, patch: Partial<Cache>) => { try { localStorage.setItem(ck(id), JSON.stringify({ ...readCache(id), ...patch })); } catch { /* ignore */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const counts = (d?: { diary: unknown[]; classes: unknown[]; units: unknown[]; assess: unknown[]; students: unknown[]; years: unknown[] }) =>
  d ? `${d.classes.length} classes, ${d.students.length} students, ${d.units.length} units, ${d.diary.length} diary entries, ${d.assess.length} assessments, ${d.years.length} year(s)` : "no data";

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
  window.addEventListener("online", () => { if (offlineMode && !dirty) void retryLoad(); else if (dirty) void flush(); });
  window.addEventListener("beforeunload", (e) => { if (dirty || saving) { e.preventDefault(); e.returnValue = ""; } });
}

let lastUser: any = null;
let offlineMode = false;

async function handleSession(user: any) {
  if (!user) {
    if (state.status !== "anon") { cloudRemove([...cloudIds]); cloudIds.clear(); set({ status: "anon", userId: null, email: null, roles: [], me: null, activeId: null, cloudIds: [], save: "idle", saveMsg: "", loadError: "" }); }
    return;
  }
  if (state.userId === user.id && state.status === "ready" && !state.loadError) return;
  if (booting === user.id) return;
  lastUser = user;
  booting = user.id;
  try { await bootstrap(user); } finally { booting = null; }
}

async function bootstrap(user: any) {
  let roles: Role[] = [];
  let me: MyProfile | null = null;
  try {
    const [r, p] = await Promise.all([sb.from("user_roles").select("role").eq("user_id", user.id), sb.from("profiles").select("*").eq("id", user.id).maybeSingle()]);
    if (r.error || p.error) throw new Error(errMsg(r.error || p.error));
    roles = (r.data ?? []).map((x: any) => x.role) as Role[];
    me = p.data ? toMe(p.data) : null;
    offlineMode = false;
    if (me && isStaff(roles)) await loadTeacher(user.id);
    writeCache(user.id, { roles, me });
    set({ status: "ready", userId: user.id, email: user.email ?? null, roles, me, loadError: "", saveMsg: "" });
    void refreshYears();
  } catch (e) {
    const cache = readCache(user.id);
    const local = getDB().data[user.id];
    if (isNetworkError(e) && cache && local) {
      // No connection: keep working from this device's copy; it is uploaded (with conflict checks) when the connection returns.
      let pending: string | null = null;
      try { pending = localStorage.getItem(pk(user.id)); } catch { /* ignore */ }
      offlineMode = true;
      versions[user.id] = pending !== null ? Number(pending) : cache.version;
      cloudIds.add(user.id);
      dirty = pending !== null;
      set({ status: "ready", userId: user.id, email: user.email ?? null, roles: cache.roles, me: cache.me, activeId: user.id, cloudIds: [...cloudIds], loadError: "", save: "error", saveMsg: "Offline — working from this device's copy. Changes upload when the connection returns." });
      if (dirty) timer = setTimeout(() => void flush(), 15000);
      return;
    }
    set({ status: "ready", userId: user.id, email: user.email ?? null, roles, me, activeId: null, loadError: errMsg(e) });
  }
}

// ---------- administrator-controlled academic year (needs docs/phase4/10_academic_years.sql) ----------
/** Reads the list of academic years. If the table does not exist yet, the feature is simply off (nothing breaks). */
export async function refreshYears() {
  try {
    const { data, error } = await sb.from("academic_years").select("id,name,is_active").order("created_at");
    if (error) { set({ yearsReady: false, yearList: [], activeYear: null }); return; }
    const list = (data ?? []) as YearRow[];
    const a = list.find((y) => y.is_active);
    set({ yearsReady: true, yearList: list, activeYear: a ? { id: a.id, name: a.name } : null });
  } catch { set({ yearsReady: false, yearList: [], activeYear: null }); }
}
export async function addAcademicYear(name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return "Enter the year name (for example 2084/85).";
  const { error } = await sb.from("academic_years").insert({ name: n });
  if (error) return /duplicate|unique/i.test(error.message) ? "This academic year already exists." : error.message;
  await refreshYears();
  return null;
}
export async function setActiveAcademicYear(id: string): Promise<string | null> {
  const { error } = await sb.rpc("set_active_academic_year", { _id: id });
  if (error) return error.message;
  await refreshYears();
  return null;
}
export async function deleteAcademicYear(id: string): Promise<string | null> {
  const { error } = await sb.from("academic_years").delete().eq("id", id);
  if (error) return error.message;
  await refreshYears();
  return null;
}

/** Try loading the diary again after a load error or when the connection is back. */
export async function retryLoad() {
  if (!lastUser || booting) return;
  booting = lastUser.id;
  set({ loadError: "" });
  try { await bootstrap(lastUser); } finally { booting = null; }
}

export async function signIn(login: string, password: string): Promise<string | null> {
  const { error } = await sb.auth.signInWithPassword({ email: toEmail(login), password });
  if (!error) return null;
  return /invalid login/i.test(error.message) ? "ID वा पासवर्ड मिलेन। / Wrong ID or password." : error.message;
}

function downloadText(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name; a.click();
}

/** Keeps a recovery copy of work that could not be uploaded: a downloaded file AND a copy stored on this device. */
function saveRecovery(id: string) {
  let text = "";
  try { text = exportProfile(id); } catch { return; }
  downloadText(`diary-unsaved-${new Date().toISOString().slice(0, 10)}.json`, text);
  try { localStorage.setItem(`shikshak-unsaved-${id}-${Date.now()}`, text); } catch { alert("Could not keep a copy on this device (storage is full). Please keep the file that was just downloaded."); }
}
export const listUnsaved = (id: string | null) => {
  const out: { key: string; at: number }[] = [];
  if (!id) return out;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) ?? ""; if (k.startsWith(`shikshak-unsaved-${id}-`)) out.push({ key: k, at: Number(k.split("-").pop()) }); } } catch { /* ignore */ }
  return out.sort((a, b) => b.at - a.at);
};
export const downloadUnsaved = (key: string) => { try { const t = localStorage.getItem(key); if (t) downloadText("diary-unsaved-copy.json", t); } catch { /* ignore */ } };
export const deleteUnsaved = (key: string) => { try { localStorage.removeItem(key); } catch { /* ignore */ } };

export async function signOut(): Promise<boolean> {
  while (saving) await sleep(100);
  const id = state.activeId;
  if (id && (dirty || state.save === "error" || state.save === "conflict")) {
    const ok = await flush();
    if (!ok) {
      const go = confirm("Your latest changes could NOT be saved to the cloud.\n\nOK = download a backup file of your unsaved work, keep a recovery copy on this device, and sign out.\nCancel = stay signed in (nothing is lost).");
      if (!go) return false;
      saveRecovery(id);
    }
  }
  for (const cid of cloudIds) { try { localStorage.removeItem(pk(cid)); localStorage.removeItem(ck(cid)); } catch { /* ignore */ } }
  cloudRemove([...cloudIds]); cloudIds.clear(); dirty = false; offlineMode = false; lastUser = null;
  set({ status: "anon", userId: null, email: null, roles: [], me: null, activeId: null, cloudIds: [], save: "idle", saveMsg: "", loadError: "", activeYear: null, yearList: [], yearsReady: false });
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
  let row: { content: unknown; version: number } | null = t.data;
  if (!row) {
    // First sign-in: create the diary record. Never carry on silently if this fails.
    const ins = await sb.from("teacher_data").insert({ teacher_id: id });
    if (ins.error) {
      const again = await sb.from("teacher_data").select("content,version").eq("teacher_id", id).maybeSingle();
      if (again.error || !again.data) throw new Error(`Could not create your diary record: ${errMsg(ins.error)}`);
      row = again.data as { content: unknown; version: number };
    } else row = { content: {}, version: 0 };
  }
  const data = row as { content: unknown; version: number };
  const prof = toProfile(p.data);
  const cloudVersion: number = data.version ?? 0;
  writeCache(id, { version: cloudVersion });
  let pending: string | null = null;
  try { pending = localStorage.getItem(pk(id)); } catch { /* ignore */ }
  const hasLocal = !!getDB().data[id];

  versions[id] = cloudVersion;
  lastProf[id] = JSON.stringify(profFields(prof));
  cloudIds.add(id);

  if (pending !== null && hasLocal) {
    // This device has changes that were never saved to the cloud: never overwrite them silently.
    cloudApply(id, prof, data.content ?? {}, true);
    set({ activeId: id, cloudIds: [...cloudIds] });
    if (Number(pending) === cloudVersion) { dirty = true; void flush(); }
    else set({ save: "conflict", saveMsg: "This device has unsaved changes, but the cloud copy was changed from elsewhere." });
    return;
  }
  cloudApply(id, prof, data.content ?? {});
  set({ activeId: id, cloudIds: [...cloudIds], save: "idle", saveMsg: "" });
}

/** Admin: open another teacher's diary (or go back to own with openTeacher(ownId)). */
export async function openTeacher(id: string) {
  if (dirty || saving || state.save === "conflict") {
    while (saving) await sleep(100);
    if (!(await flush())) throw new Error("Your current diary has changes that are not saved yet. Wait for “Saved ✓” (or fix the warning at the top), then try again.");
  }
  await loadTeacher(id);
}

// ---------- saving ----------
let timer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let saving = false;

function schedule() {
  const id = state.activeId;
  if (!id || state.status === "anon") return;
  // Safety net: while signed in, the open diary must be the cloud diary, otherwise edits would silently stay on this device only.
  if (getDB().current !== id) { queueMicrotask(() => mutate((x) => { x.current = id; }, false, true)); return; }
  if (state.save === "conflict") return;
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
    offlineMode = false;
    writeCache(id, { version: v + 1 });
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

/** "Try again now" button for a failed save. */
export async function retryNow() {
  if (!state.activeId) return;
  dirty = true;
  await flush();
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

/** Copy an old on-device profile into the signed-in account (the old copy stays on the device as a backup).
 *  The cloud diary is REPLACED by that copy, so the current cloud copy is downloaded first. */
export function importLocalToCloud(localId: string): { ok: boolean; msg: string } {
  const id = state.userId;
  if (!id || state.activeId !== id) return { ok: false, msg: "Open your own diary first." };
  if (dirty || saving || state.save === "error" || state.save === "conflict") return { ok: false, msg: "Wait until the top bar shows “Saved ✓”, then try again." };
  const db = getDB();
  const lp = db.profiles.find((p) => p.id === localId);
  const ld = db.data[localId];
  if (!lp || !ld) return { ok: false, msg: "Profile not found." };
  const cur = db.data[id];
  if (cur && cur.diary.length + cur.units.length + cur.assess.length + cur.classes.length > 0) {
    try { downloadText(`diary-cloud-copy-before-import-${Date.now()}.json`, exportProfile(id)); } catch { /* ignore */ }
  }
  const { designation, dept, campus, address, hod, chief } = lp;
  replaceData(id, ld, { designation, dept, campus, address, hod, chief });
  return { ok: true, msg: `Moved: ${counts(getDB().data[id])}. Saving to the cloud… (the old copy stays on this device; compare the numbers with your old diary).` };
}
