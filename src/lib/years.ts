import type { Cls, Data, Student, WorkKey } from "./store";
import { uid } from "./id";
import { syncText } from "./students";

/** The lists that belong to ONE academic year. Everything else (years, settings) is shared. */
export const WORK_KEYS: WorkKey[] = ["classes", "units", "cal", "lessons", "plans", "blended", "diary", "assess", "acts", "reminders", "leaves", "students"];

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const snapshot = (d: Data) => { const o: any = {}; for (const k of WORK_KEYS) o[k] = clone(d[k]); return o as Partial<Pick<Data, WorkKey>>; };
function loadSet(d: Data, set: any) { for (const k of WORK_KEYS) (d as any)[k] = Array.isArray(set?.[k]) ? clone(set[k]) : []; }

export const currentYear = (d: Pick<Data, "years" | "settings">) => d.years.find((y) => y.id === d.settings.yearId);
export const latestYear = (d: Pick<Data, "years">) => d.years[d.years.length - 1];
/** true when an older year is open for viewing/editing */
export const isPast = (d: Pick<Data, "years" | "settings">) => { const l = latestYear(d); return !!l && d.settings.yearId !== l.id; };

export function switchYear(d: Data, id: string): string | null {
  if (!d.years.some((y) => y.id === id)) return "Unknown academic year.";
  if (id === d.settings.yearId) return null;
  d.archive[d.settings.yearId] = snapshot(d);
  loadSet(d, d.archive[id]);
  delete d.archive[id];
  d.settings.yearId = id;
  return null;
}

export function renameYear(d: Data, id: string, name: string): string | null {
  const n = name.trim();
  if (!n) return "Enter a name.";
  if (d.years.some((y) => y.id !== id && y.name.toLowerCase() === n.toLowerCase())) return "A year with this name already exists.";
  const y = d.years.find((x) => x.id === id);
  if (y) y.name = n;
  return null;
}

/** "2083/84" -> "2084/85", "2083" -> "2084" */
export function nextYearName(name: string) {
  const m = /^\s*(\d{4})\s*\/\s*(\d{2,4})\s*$/.exec(name);
  if (m) { const y = +m[1]! + 1; return `${y}/${String((y + 1) % 100).padStart(2, "0")}`; }
  const s = /^\s*(\d{4})\s*$/.exec(name);
  return s ? String(+s[1]! + 1) : "";
}

export type CarryRow = { classId: string; carry: boolean; newName: string; students: boolean };
export type CarryOpts = { name: string; rows: CarryRow[]; units: boolean; calendar: boolean; lessons: boolean };

/** Saves the open year as an archive, then opens a new year with the chosen things carried over (all editable afterwards). */
export function startYear(d: Data, o: CarryOpts): string | null {
  const name = o.name.trim();
  if (!name) return "Enter a name for the new year.";
  if (d.years.some((y) => y.name.toLowerCase() === name.toLowerCase())) return "A year with this name already exists.";
  const prev: any = snapshot(d);
  d.archive[d.settings.yearId] = prev;
  const id = uid();
  d.years.push({ id, name });
  d.settings.yearId = id;

  const map: Record<string, string> = {};
  const classes: Cls[] = [], students: Student[] = [];
  for (const r of o.rows) {
    const c: Cls | undefined = prev.classes.find((x: Cls) => x.id === r.classId);
    if (!r.carry || !c || c.closed) continue;
    const nid = uid();
    map[c.id] = nid;
    classes.push({ ...c, id: nid, name: r.newName.trim() || c.name, year: name, pending: true, closed: false, students: "" });
    if (r.students) for (const s of prev.students as Student[]) if (s.classId === c.id && s.active) students.push({ ...s, classId: nid, history: [] });
  }
  const carry = <T extends { id: string; classId: string }>(arr: T[], fix: (x: T) => T) =>
    arr.filter((x) => map[x.classId]).map((x) => fix({ ...clone(x), id: uid(), classId: map[x.classId]! }));

  loadSet(d, {});
  d.classes = classes;
  d.students = students;
  if (o.units) d.units = carry(prev.units, (u: any) => ({ ...u, from: "", to: "" }));
  if (o.lessons) { d.lessons = carry(prev.lessons, (x: any) => x); d.plans = carry(prev.plans.filter((p: any) => map[p.classId]), (x: any) => x); d.blended = carry((prev as any).blended ?? [], (x: any) => x); }
  if (o.calendar) d.cal = prev.cal.map((e: any) => ({ ...clone(e), id: uid() }));
  syncText(d);
  return null;
}

export type SubjectOpts = { subject: string; code: string; totalLh: number; name: string };

/** The class gets a new subject: the old subject's class is closed (its diary and records stay as they were) and the students move to a fresh class. */
export function upgradeSubject(d: Data, classId: string, o: SubjectOpts): string | null {
  const old = d.classes.find((c) => c.id === classId);
  if (!old || old.closed) return "Class not found or already closed.";
  if (!o.subject.trim()) return "Enter the new subject.";
  syncText(d); // freeze the up-to-date list on the old class
  const nid = uid();
  d.classes.push({ id: nid, name: o.name.trim() || old.name, subject: o.subject.trim(), code: o.code.trim(), year: old.year, totalLh: Number(o.totalLh) || 0, students: "", pending: false, closed: false });
  old.closed = true;
  for (const s of d.students) if (s.classId === classId && s.active) { if (!s.history.includes(classId)) s.history.push(classId); s.classId = nid; }
  syncText(d);
  return null;
}

export function keepSubject(d: Data, classId: string) {
  const c = d.classes.find((x) => x.id === classId);
  if (c) c.pending = false;
}
