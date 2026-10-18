import { useSyncExternalStore } from "react";

export type Profile = {
  id: string; name: string; designation: string; dept: string;
  campus: string; address: string; hod: string; chief: string;
};
export type Cls = { id: string; name: string; subject: string; code: string; year: string; totalLh: number; students: string };
export type Unit = { id: string; classId: string; unit: string; topics: string; lh: number; from: string; to: string; methods: string; materials: string; assessment: string };
export type CalEvent = { id: string; type: string; title: string; from: string; to: string };
export type Lesson = { id: string; classId: string; date: string; from: string; to: string; title: string; level: string; objectives: string; steps: { step: string; activity: string; theory: string }[]; resources: string; assessment: string };
export type Plan = { id: string; type: string; classId: string; date: string; title: string; content: string; status: string };
export type Diary = { id: string; classId: string; date: string; total: number; absent: string[]; reasons: string; codes: string[]; lh: number; unitId: string; topic: string; methods: string; studentActs: string; feedback: string; evaluation: string; remarks: string };
export type Assess = { id: string; classId: string; date: string; kind: string; title: string; max: number; marks: Record<string, { m: string; c: string }> };
export type Act = { id: string; date: string; category: string; title: string; details: string };
export type Reminder = { id: string; date: string; time: string; title: string; note: string; status: string };

export type Data = {
  classes: Cls[]; units: Unit[]; cal: CalEvent[]; lessons: Lesson[]; plans: Plan[];
  diary: Diary[]; assess: Assess[]; acts: Act[]; reminders: Reminder[];
};
type DB = { profiles: Profile[]; current: string | null; data: Record<string, Data> };

export const emptyData = (): Data => ({ classes: [], units: [], cal: [], lessons: [], plans: [], diary: [], assess: [], acts: [], reminders: [] });
const EMPTY: DB = { profiles: [], current: null, data: {} };
const KEY = "shikshak-diary-v1";

let db: DB = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
}

export function mutate(fn: (d: DB) => void) {
  load();
  const next = structuredClone(db);
  fn(next);
  db = next;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
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

export const uid = () => Math.random().toString(36).slice(2, 10);
export const studentsOf = (c?: Cls) => (c?.students || "").split("\n").map((s) => s.trim()).filter(Boolean);

export function exportProfile(id: string) {
  const p = db.profiles.find((x) => x.id === id);
  return JSON.stringify({ profile: p, data: db.data[id] ?? emptyData() }, null, 2);
}
export function importProfile(json: string) {
  const o = JSON.parse(json);
  if (!o.profile?.name) throw new Error("Invalid backup file");
  mutate((x) => {
    const id = uid();
    x.profiles.push({ ...o.profile, id });
    x.data[id] = { ...emptyData(), ...o.data };
    x.current = id;
  });
}
