import { studentsOf, type Data } from "./store";

const LABEL: Record<string, string> = {
  students: "students", diary: "diary entries", plans: "plans", units: "units", lessons: "lessons", blended: "blended lesson plans",
  assess: "assessments / marks", acts: "activities", reminders: "reminders", leaves: "leave records", cal: "calendar events",
};

/**
 * What is already recorded against a class (this year and earlier years).
 * An empty list means the class has no other data and can be deleted safely.
 */
export function classDataSummary(d: Data, id: string): string[] {
  const hits: string[] = [];
  const count = (v: unknown) => (Array.isArray(v) ? v.filter((x: any) => x && x.classId === id).length : 0);
  for (const [k, v] of Object.entries(d)) {
    if (k === "classes" || k === "years" || k === "settings" || k === "archive") continue;
    const n = count(v);
    if (n) hits.push(`${n} ${LABEL[k] ?? k}`);
  }
  for (const a of Object.values(d.archive ?? {})) {
    for (const [k, v] of Object.entries(a ?? {})) {
      if (k === "classes") continue;
      const n = count(v);
      if (n) hits.push(`${n} ${LABEL[k] ?? k} (earlier year)`);
    }
  }
  if (d.students.some((s) => s.history?.includes(id)) && !hits.some((h) => h.includes("students"))) hits.push("students who studied here earlier");
  const c = d.classes.find((x) => x.id === id);
  if (c && !hits.some((h) => h.includes("students")) && studentsOf(c).length) hits.push(`${studentsOf(c).length} students`);
  return hits;
}
