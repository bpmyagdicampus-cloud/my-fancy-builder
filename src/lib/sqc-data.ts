import { supabase } from "@/integrations/supabase/client";
import type { Action, Period, Report, ReportDraft, SqcClass, Status } from "@/lib/sqc";

// All SQC reads/writes go straight to Supabase WITH the signed-in user's login, so the database's row-level
// security (docs/phase4/20_sqc.sql) decides what each person may see or change — not this code.
const sb = supabase as any;

export type R<T> = { ok: true; data: T } | { ok: false; error: string };
export type Membership = { user_id: string; class_id: string; is_rep: boolean };
export type Teacher = { teacher_id: string; teacher_name: string };

export function friendly(e: any): string {
  const m = String(e?.message ?? e ?? "");
  if (e?.code === "42P01" || /does not exist|schema cache|relation/i.test(m)) return "SQC is not set up yet: the database tables are missing. Ask the administrator to run the SQC SQL (docs/phase4).";
  if (e?.code === "23505" || /duplicate key|unique/i.test(m)) return "A report for this class, date and period already exists. Open it from the list and edit it instead.";
  if (e?.code === "23503" || /foreign key/i.test(m)) return "This item is still used by other records, so it cannot be deleted.";
  if (e?.code === "42501" || /row-level security|permission denied/i.test(m)) return "You are not allowed to do this.";
  if (e?.code === "23514" || /violates check/i.test(m)) return "Some values are not allowed (check the times, reason and student counts).";
  return m || "Something went wrong.";
}
async function run<T>(p: PromiseLike<{ data: any; error: any }>, pick: (d: any) => T): Promise<R<T>> {
  try { const { data, error } = await p; return error ? { ok: false, error: friendly(error) } : { ok: true, data: pick(data) }; }
  catch (e) { return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` }; }
}

export const loadMemberships = (userId: string) => run<Membership[]>(sb.from("sqc_members").select("user_id,class_id,is_rep").eq("user_id", userId), (d) => d ?? []);
export const loadAllMembers = () => run<Membership[]>(sb.from("sqc_members").select("user_id,class_id,is_rep"), (d) => d ?? []);
// SQC uses the central class list from Setup (setup_classes) — see docs/phase5/40_sqc_central_classes.sql
export const loadClasses = () => run<SqcClass[]>(sb.from("setup_classes").select("id,name").order("name"), (d) => (d ?? []).map((c: any) => ({ id: c.id, name: c.name, section: "" })));
export const loadPeriods = () => run<Period[]>(sb.from("sqc_periods").select("period_no,start_time,end_time").order("period_no"), (d) => d ?? []);
export const loadTeachers = () => run<Teacher[]>(sb.rpc("sqc_teacher_list"), (d) => d ?? []);
export const loadReports = () => run<Report[]>(sb.from("sqc_reports").select("*").order("report_date", { ascending: false }).limit(5000), (d) => d ?? []);
export const loadActions = () => run<Action[]>(sb.from("sqc_actions").select("*").order("created_at", { ascending: true }).limit(10000), (d) => d ?? []);

const FIELDS = ["class_id", "report_date", "period_no", "teacher_id", "teacher_name", "subject", "held", "arrival_time", "departure_time", "not_held_reason", "present_count", "total_count", "issues", "facilities", "requests", "suggestions"] as const;
export function reportPayload(d: ReportDraft) {
  const o: Record<string, unknown> = {};
  for (const k of FIELDS) o[k] = (d as any)[k] ?? null;
  o.period_no = Number(d.period_no);
  o.teacher_id = d.teacher_id || null;
  o.teacher_name = d.teacher_name ?? "";
  for (const k of ["subject", "not_held_reason", "issues", "facilities", "requests", "suggestions"]) o[k] = String((d as any)[k] ?? "").trim();
  o.present_count = d.present_count === undefined || d.present_count === null || (d.present_count as unknown) === "" ? null : Number(d.present_count);
  o.total_count = d.total_count === undefined || d.total_count === null || (d.total_count as unknown) === "" ? null : Number(d.total_count);
  if (d.held) o.not_held_reason = String(d.not_held_reason ?? "").trim(); else { o.arrival_time = null; o.departure_time = null; }
  o.arrival_time = d.held ? d.arrival_time || null : null;
  o.departure_time = d.held ? d.departure_time || null : null;
  return o;
}
export async function saveReport(d: ReportDraft & { id?: string }): Promise<R<Report>> {
  const body = reportPayload(d);
  return d.id
    ? run<Report>(sb.from("sqc_reports").update(body).eq("id", d.id).select("*").maybeSingle(), (x) => x)
    : run<Report>(sb.from("sqc_reports").insert(body).select("*").maybeSingle(), (x) => x);
}
export const deleteReport = (id: string) => run<null>(sb.from("sqc_reports").delete().eq("id", id), () => null);
export const addAction = (a: { report_id: string; response: string; responsible: string; action_taken: string; resolved_on: string | null; status: Status }) =>
  run<null>(sb.from("sqc_actions").insert(a), () => null);

// ----- administrator: classes, members, periods -----
/** Brings the classes created in Setup into SQC (and links older SQC classes to them). Nothing is deleted. */
// Classes live only in Setup -> Classes now; SQC reads them directly, so there is nothing to sync or edit here.
export const syncClasses = async (): Promise<R<number>> => ({ ok: true, data: 0 });
const SETUP_ONLY = "Classes are created and renamed in Setup -> Classes.";
export const saveClass = async (_c: { id?: string; name: string; section: string }): Promise<R<null>> => ({ ok: false, error: SETUP_ONLY });
export const deleteClass = async (_id: string): Promise<R<null>> => ({ ok: false, error: SETUP_ONLY });
export const setMember = (m: Membership) => run<null>(sb.from("sqc_members").upsert(m, { onConflict: "user_id,class_id" }), () => null);
export const removeMember = (userId: string, classId: string) => run<null>(sb.from("sqc_members").delete().eq("user_id", userId).eq("class_id", classId), () => null);
export const savePeriod = (p: Period) => run<null>(sb.from("sqc_periods").upsert({ period_no: p.period_no, start_time: p.start_time, end_time: p.end_time }, { onConflict: "period_no" }), () => null);
export const deletePeriod = (n: number) => run<null>(sb.from("sqc_periods").delete().eq("period_no", n), () => null);
