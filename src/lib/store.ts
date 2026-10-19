import { useSyncExternalStore } from "react";
import { DEFAULT_WEEKLY_OFF, normalizeData } from "./migrate";
import { uid } from "./id";
export { uid };

export type Profile = {
  id: string; name: string; designation: string; dept: string;
  campus: string; address: string; hod: string; chief: string;
};
export type Cls = {
  id: string; name: string; subject: string; code: string; year: string; totalLh: number; students: string;
  /** subject was replaced by "Upgrade subject": kept for history, hidden from new entries */
  closed?: boolean;
  /** carried into a new academic year but the subject has not been upgraded/confirmed yet */
  pending?: boolean;
};
export type Year = { id: string; name: string };
/** Master record of a student. The id never changes, even when the name or class does. */
export type Student = { id: string; classId: string; name: string; roll: number; active: boolean; history: string[] };
export type Unit = { id: string; classId: string; unit: string; topics: string; lh: number; from: string; to: string; methods: string; materials: string; assessment: string };
export type CalEvent = { id: string; type: string; title: string; from: string; to: string };
export type Lesson = { id: string; classId: string; date: string; from: string; to: string; title: string; level: string; objectives: string; steps: { step: string; activity: string; theory: string }[]; resources: string; assessment: string };
export type Plan = { id: string; type: string; classId: string; date: string; title: string; content: string; status: string };
export type Diary = { id: string; classId: string; date: string; total: number; absent: string[]; reasons: string; codes: string[]; lh: number; unitId: string; topic: string; methods: string; studentActs: string; feedback: string; evaluation: string; remarks: string };
export type Assess = { id: string; classId: string; date: string; kind: string; title: string; max: number; marks: Record<string, { m: string; c: string }> };
export type Act = { id: string; date: string; category: string; title: string; details: string };
export type Reminder = { id: string; date: string; time: string; title: string; note: string; status: string };
/** Teacher's own leave. Kept in Records, NOT in the academic calendar; counted in the monthly report. */
export type Leave = { id: string; kind: string; from: string; to: string; reason: string };
export type Settings = { weeklyOff: string[]; yearId: string };

export type Data = {
  classes: Cls[]; units: Unit[]; cal: CalEvent[]; lessons: Lesson[]; plans: Plan[];
  diary: Diary[]; assess: Assess[]; acts: Act[]; reminders: Reminder[];
  leaves: Leave[]; settings: Settings;
  students: Student[]; years: Year[];
  /** other academic years' records, stored while a different year is open */
  archive: Record<string, Partial<Pick<Data, WorkKey>>>;
};
/** The lists that belong to one academic year. */
export type WorkKey = "classes" | "units" | "cal" | "lessons" | "plans" | "diary" | "assess" | "acts" | "reminders" | "leaves" | "students";
/** Keys of Data that hold a list of records (used by the generic Collection editor). */
export type ListKey = Exclude<keyof Data, "settings" | "years" | "archive">;
type DB = { profiles: Profile[]; current: string | null; data: Record<string, Data> };

export const emptyData = (): Data => ({
  classes: [], units: [], cal: [], lessons: [], plans: [], diary: [], assess: [], acts: [], reminders: [],
  leaves: [], settings: { weeklyOff: [...DEFAULT_WEEKLY_OFF], yearId: "" },
  students: [], years: [], archive: {},
});
/** Empty data for a brand-new profile, including its first academic year. */
export const freshData = (): Data => normalizeData(emptyData());
const EMPTY: DB = { profiles: [], current: null, data: {} };
const KEY = "shikshak-diary-v1";
const PRE_UPDATE_KEY = "shikshak-diary-v1-before-update"; // untouched copy of the data made once, before the first migration
const BACKUP_KEY = "shikshak-diary-last-backup";

let db: DB = EMPTY;
let loaded = false;
let loadError: string | null = null;
let warned = false;
let afterMutate: (() => void) | null = null;
/** The cloud layer registers here to be told about every normal (non-silent) change. */
export const setAfterMutate = (fn: (() => void) | null) => { afterMutate = fn; };
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { loadError = "Browser storage is not available, so nothing can be saved."; return; }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad shape");
    try { if (!localStorage.getItem(PRE_UPDATE_KEY)) localStorage.setItem(PRE_UPDATE_KEY, raw); } catch { /* ignore */ }
    const data: Record<string, Data> = {};
    for (const [id, v] of Object.entries(parsed.data ?? {})) data[id] = normalizeData(v);
    db = {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      current: typeof parsed.current === "string" ? parsed.current : null,
      data,
    };
  } catch {
    // Never continue with an empty database here: the next save would overwrite the real data.
    loadError = "Saved diary data could not be read. A copy of it was kept in this browser.";
    try { localStorage.setItem(`${KEY}-corrupt-${Date.now()}`, raw); } catch { /* ignore */ }
  }
}

export const getLoadError = () => { load(); return loadError; };

/** `force` is used only by "Restore from backup", which is allowed to start from a clean state. */
export function mutate(fn: (d: DB) => void, force = false, silent = false) {
  load();
  if (loadError) {
    if (!force) {
      if (!warned) { warned = true; alert(`${loadError}\n\nNew changes are NOT saved. Open "Teacher profiles" and use "Restore from backup".`); }
      return;
    }
    loadError = null;
    db = structuredClone(EMPTY);
  }
  const next = structuredClone(db);
  fn(next);
  db = next;
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { alert("Could not save to this browser (storage may be full). Please download a backup now (Teacher profiles → Backup)."); }
  listeners.forEach((l) => l());
  if (!silent) afterMutate?.();
}

export const getDB = () => { load(); return db; };

/** Put cloud data into the local working copy WITHOUT triggering a cloud save. */
export function cloudApply(id: string, profile: Profile, content: unknown, keepLocalData = false) {
  mutate((x) => {
    const i = x.profiles.findIndex((p) => p.id === id);
    if (i >= 0) x.profiles[i] = profile; else x.profiles.push(profile);
    if (!keepLocalData || !x.data[id]) x.data[id] = normalizeData(content);
    x.current = id;
  }, false, true);
}
/** Remove cloud users' data from this device (on sign-out). Old local-only profiles are never touched. */
export function cloudRemove(ids: string[]) {
  if (!ids.length) return;
  mutate((x) => {
    x.profiles = x.profiles.filter((p) => !ids.includes(p.id));
    for (const id of ids) delete x.data[id];
    if (x.current && ids.includes(x.current)) x.current = x.profiles.find((p) => !ids.includes(p.id))?.id ?? null;
  }, false, true);
}
/** Replace one profile's data (used when importing an old local profile into the cloud account). Triggers a cloud save. */
export function replaceData(id: string, content: unknown, patch: Partial<Profile>) {
  mutate((x) => {
    x.data[id] = normalizeData(content);
    const i = x.profiles.findIndex((p) => p.id === id);
    if (i >= 0) x.profiles[i] = { ...x.profiles[i]!, ...patch, id };
  });
}

const subscribe = (l: () => void) => { load(); listeners.add(l); return () => listeners.delete(l); };
const snap = () => { load(); return db; };

export const useDB = () => useSyncExternalStore(subscribe, snap, () => EMPTY);

export function useTeacher() {
  const d = useDB();
  const profile = d.profiles.find((p) => p.id === d.current);
  const data = profile ? { ...emptyData(), ...d.data[profile.id] } : emptyData();
  return { profile, data, profiles: d.profiles };
}

export function updateData(fn: (d: Data) => void) {
  mutate((x) => {
    if (!x.current) return;
    x.data[x.current] = { ...emptyData(), ...x.data[x.current] };
    fn(x.data[x.current]!);
  });
}

export const studentsOf = (c?: Cls) => (c?.students || "").split("\n").map((s) => s.trim()).filter(Boolean);

export function markBackup() { try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch { /* ignore */ } }
/** Days since the last downloaded backup, or null if no backup was ever downloaded on this device. */
export function daysSinceBackup(): number | null {
  try {
    const s = localStorage.getItem(BACKUP_KEY);
    if (!s) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86400000));
  } catch { return null; }
}

export function exportProfile(id: string) {
  const p = db.profiles.find((x) => x.id === id);
  return JSON.stringify({ profile: p, data: db.data[id] ?? emptyData() }, null, 2);
}
/** `select`: switch to the restored profile (leave false while signed in to the cloud, so the open cloud diary stays open). */
export function importProfile(json: string, select = true) {
  const o = JSON.parse(json);
  if (!o || typeof o !== "object" || !o.profile?.name) throw new Error("Invalid backup file");
  if (o.data !== undefined && (typeof o.data !== "object" || o.data === null || Array.isArray(o.data))) throw new Error("Invalid backup file: data section is damaged");
  mutate((x) => {
    const id = uid();
    x.profiles.push({ ...o.profile, id });
    x.data[id] = normalizeData(o.data);
    if (select) x.current = id;
  }, true);
}
