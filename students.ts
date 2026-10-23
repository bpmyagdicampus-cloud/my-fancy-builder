import type { Data, Student } from "./store";
import { uid } from "./id";

// The student registry (Data.students) is the master list. Each open class keeps a text copy of its
// active students in `class.students` (one name per line) so older screens keep working unchanged.

const lines = (t?: string) => (t || "").split("\n").map((s) => s.trim()).filter(Boolean);
export const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const byRoll = (a: Student, b: Student) => a.roll - b.roll || a.name.localeCompare(b.name);

export const classStudents = (d: Pick<Data, "students">, classId: string, onlyActive = true) =>
  d.students.filter((s) => s.classId === classId && (!onlyActive || s.active)).sort(byRoll);

/** Rewrites the text list of every OPEN class from the registry. Closed classes keep their frozen list. */
export function syncText(d: Data) {
  for (const c of d.classes) {
    if (c.closed) continue;
    if (!d.students.some((s) => s.classId === c.id)) continue;
    c.students = classStudents(d, c.id).map((s) => s.name).join("\n");
  }
}

/** One-time conversion: classes that still only have a text list get registry entries (names unchanged). */
export function ensureRegistry(d: Data) {
  for (const c of d.classes) {
    if (c.closed || d.students.some((s) => s.classId === c.id)) continue;
    lines(c.students).forEach((name, i) => d.students.push({ id: uid(), classId: c.id, name, roll: i + 1, active: true, history: [] }));
  }
}

const nextRoll = (d: Data, classId: string) => d.students.filter((s) => s.classId === classId).reduce((m, s) => Math.max(m, s.roll), 0) + 1;
const nameTaken = (d: Data, classId: string, name: string, exceptId?: string) =>
  d.students.some((s) => s.classId === classId && s.id !== exceptId && normName(s.name) === normName(name));

export function addStudents(d: Data, classId: string, names: string[]) {
  const added: string[] = [], skipped: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name) continue;
    if (nameTaken(d, classId, name)) { skipped.push(name); continue; }
    d.students.push({ id: uid(), classId, name, roll: nextRoll(d, classId), active: true, history: [] });
    added.push(name);
  }
  syncText(d);
  return { added, skipped };
}

/** Renames a student and carries the new name into every attendance list and mark sheet of this year that used the old one. */
export function renameStudent(d: Data, id: string, newName: string): string | null {
  const s = d.students.find((x) => x.id === id);
  if (!s) return "Student not found.";
  const name = newName.trim().replace(/\s+/g, " ");
  if (!name) return "Name cannot be empty.";
  if (name === s.name) return null;
  if (nameTaken(d, s.classId, name, id)) return "Another student in this class already has this name.";
  const old = s.name;
  const where = new Set([s.classId, ...s.history]);
  for (const e of d.diary) if (where.has(e.classId)) e.absent = e.absent.map((n) => (n === old ? name : n));
  for (const a of d.assess) {
    if (where.has(a.classId) && old in a.marks && !(name in a.marks)) { a.marks[name] = a.marks[old]!; delete a.marks[old]; }
  }
  for (const c of d.classes) {
    if (c.closed && where.has(c.id)) c.students = lines(c.students).map((n) => (n === old ? name : n)).join("\n");
  }
  s.name = name;
  syncText(d);
  return null;
}

export function setRoll(d: Data, id: string, roll: number) {
  const s = d.students.find((x) => x.id === id);
  if (s && Number.isFinite(roll) && roll > 0) { s.roll = Math.round(roll); syncText(d); }
}
export function setActive(d: Data, id: string, active: boolean) {
  const s = d.students.find((x) => x.id === id);
  if (s) { s.active = active; syncText(d); }
}

/** Moves students to another class (promotion, transfer). Past attendance stays with the class it was taken in. */
export function moveStudents(d: Data, ids: string[], toClassId: string) {
  const target = d.classes.find((c) => c.id === toClassId);
  const moved: string[] = [], conflicts: string[] = [];
  if (!target || target.closed) return { moved, conflicts: ["Choose an open class."] };
  for (const id of ids) {
    const s = d.students.find((x) => x.id === id);
    if (!s || s.classId === toClassId) continue;
    if (nameTaken(d, toClassId, s.name)) { conflicts.push(s.name); continue; }
    if (!s.history.includes(s.classId)) s.history.push(s.classId);
    s.classId = toClassId;
    s.roll = nextRoll(d, toClassId);
    moved.push(s.name);
  }
  syncText(d);
  return { moved, conflicts };
}

/** Names that appear in this class's attendance lists or mark sheets but are not in the registry. */
export function missingNames(d: Data, classId: string): string[] {
  const known = new Set(d.students.filter((s) => s.classId === classId).map((s) => normName(s.name)));
  const out: string[] = [], seen = new Set<string>();
  const add = (n: string) => { const k = normName(n); if (k && !known.has(k) && !seen.has(k)) { seen.add(k); out.push(n.trim()); } };
  [...d.diary].filter((e) => e.classId === classId).sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => e.absent.forEach(add));
  d.assess.filter((a) => a.classId === classId).forEach((a) => Object.keys(a.marks).forEach(add));
  return out;
}
export const importMissing = (d: Data, classId: string) => addStudents(d, classId, missingNames(d, classId));
