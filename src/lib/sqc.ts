// SQC (Student Quality Control) — types and pure logic (validation, filtering, summaries). No database calls here.

export const STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_NE: Record<Status, string> = { Submitted: "पेस भएको", "Under Review": "समीक्षामा", "In Progress": "प्रक्रियामा", Resolved: "समाधान भएको" };

export type SqcClass = { id: string; name: string; section: string };
export type Period = { period_no: number; start_time: string; end_time: string };
export type Action = { id: string; report_id: string; response: string; responsible: string; action_taken: string; resolved_on: string | null; status: Status; created_at: string };
export type Report = {
  id: string; class_id: string; report_date: string; period_no: number;
  teacher_id: string | null; teacher_name: string; subject: string;
  held: boolean; arrival_time: string | null; departure_time: string | null; not_held_reason: string;
  present_count: number | null; total_count: number | null;
  issues: string; facilities: string; requests: string; suggestions: string;
  status: Status; submitted_by_name: string; submitted_at: string; year_name: string;
};
export type ReportDraft = Partial<Report> & { class_id: string };

export const className = (c?: SqcClass) => (c ? `${c.name}${c.section ? ` (${c.section})` : ""}` : "—");
export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");
export const toMin = (t?: string | null) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : null; };
export const fmtMin = (n: number) => { const s = n < 0 ? "-" : ""; const a = Math.abs(Math.round(n)); return a >= 60 ? `${s}${Math.floor(a / 60)}h ${a % 60}m` : `${s}${a}m`; };

/** Friendly check done before saving (the database enforces the same rules). */
export function validateReport(r: ReportDraft): string | null {
  if (!r.class_id) return "Choose the class.";
  if (!r.report_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.report_date)) return "Choose the date.";
  const p = Number(r.period_no);
  if (!Number.isInteger(p) || p < 1 || p > 12) return "Choose the period (1–12).";
  if (!r.teacher_id && !(r.teacher_name ?? "").trim()) return "Choose the teacher.";
  if (r.held === undefined || r.held === null) return "Say whether the class was held.";
  if (r.held) {
    if (!r.arrival_time) return "Enter the teacher's arrival time.";
    const a = toMin(r.arrival_time), d = toMin(r.departure_time);
    if (r.departure_time && a !== null && d !== null && d <= a) return "Departure time must be after arrival time.";
  } else if (!(r.not_held_reason ?? "").trim()) return "Give the reason the class was not held.";
  const pc = r.present_count, tc = r.total_count;
  if (pc != null && pc < 0) return "Present students cannot be negative.";
  if (pc != null && tc != null && pc > tc) return "Present students cannot be more than total students.";
  return null;
}

/** Minutes the teacher came after the scheduled start (negative = early). null when it cannot be known. */
export function lateMinutes(r: Pick<Report, "held" | "arrival_time" | "period_no">, periods: Period[]) {
  if (!r.held) return null;
  const per = periods.find((p) => p.period_no === r.period_no);
  const a = toMin(r.arrival_time), s = toMin(per?.start_time);
  return a === null || s === null ? null : a - s;
}
/** Minutes actually spent in class (departure - arrival). */
export function durationMinutes(r: Pick<Report, "held" | "arrival_time" | "departure_time">) {
  if (!r.held) return null;
  const a = toMin(r.arrival_time), d = toMin(r.departure_time);
  return a === null || d === null || d < a ? null : d - a;
}

export type Filters = { classId?: string; teacherId?: string; from?: string; to?: string; period?: number; status?: string; q?: string; held?: "yes" | "no" | "" };
export function filterReports(rows: Report[], f: Filters, classes: SqcClass[] = []) {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.classId && r.class_id !== f.classId) return false;
    if (f.teacherId && r.teacher_id !== f.teacherId) return false;
    if (f.from && r.report_date < f.from) return false;
    if (f.to && r.report_date > f.to) return false;
    if (f.period && r.period_no !== f.period) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.held === "yes" && !r.held) return false;
    if (f.held === "no" && r.held) return false;
    if (q) {
      const hay = [r.teacher_name, r.subject, r.issues, r.facilities, r.requests, r.suggestions, r.not_held_reason, r.submitted_by_name, className(classes.find((c) => c.id === r.class_id))].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.report_date.localeCompare(a.report_date) || b.period_no - a.period_no);
}

/** First/last day key of a BS month "2083-05" for range filters (string comparison works). */
export const monthRange = (ym: string) => ({ from: `${ym}-00`, to: `${ym}-99` });

export type Row = { key: string; name: string; reports: number; held: number; notHeld: number; late: number; lateMin: number; timed: number; durationMin: number; withIssues: number };
export type Summary = { total: number; held: number; notHeld: number; byStatus: Record<Status, number>; late: number; avgLate: number | null; avgDuration: number | null; withIssues: number; byClass: Row[]; byTeacher: Row[] };

const hasIssue = (r: Report) => [r.issues, r.facilities, r.requests, r.suggestions].some((s) => (s ?? "").trim());
function bump(map: Map<string, Row>, key: string, name: string, r: Report, periods: Period[]) {
  const row = map.get(key) ?? { key, name, reports: 0, held: 0, notHeld: 0, late: 0, lateMin: 0, timed: 0, durationMin: 0, withIssues: 0 };
  row.reports++; r.held ? row.held++ : row.notHeld++;
  const l = lateMinutes(r, periods); if (l !== null) { row.timed++; if (l > 0) { row.late++; row.lateMin += l; } }
  const d = durationMinutes(r); if (d !== null) row.durationMin += d;
  if (hasIssue(r)) row.withIssues++;
  map.set(key, row);
}
export function summarize(rows: Report[], periods: Period[], classes: SqcClass[]): Summary {
  const byStatus = { Submitted: 0, "Under Review": 0, "In Progress": 0, Resolved: 0 } as Record<Status, number>;
  const cls = new Map<string, Row>(), tea = new Map<string, Row>();
  let late = 0, lateSum = 0, lateN = 0, durSum = 0, durN = 0, issues = 0, held = 0;
  for (const r of rows) {
    byStatus[r.status]++;
    if (r.held) held++;
    const l = lateMinutes(r, periods); if (l !== null) { lateN++; lateSum += l; if (l > 0) late++; }
    const d = durationMinutes(r); if (d !== null) { durSum += d; durN++; }
    if (hasIssue(r)) issues++;
    bump(cls, r.class_id, className(classes.find((c) => c.id === r.class_id)), r, periods);
    bump(tea, r.teacher_id ?? `n:${r.teacher_name}`, r.teacher_name || "—", r, periods);
  }
  const sort = (m: Map<string, Row>) => [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { total: rows.length, held, notHeld: rows.length - held, byStatus, late, avgLate: lateN ? lateSum / lateN : null, avgDuration: durN ? durSum / durN : null, withIssues: issues, byClass: sort(cls), byTeacher: sort(tea) };
}
