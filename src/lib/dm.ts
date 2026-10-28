import { supabase } from "@/integrations/supabase/client";
import { friendly, type R } from "@/lib/sqc-data";

// Department Management (docs/phase6/40_dept_mgmt.sql). Every call runs WITH the signed-in user's login,
// so the database's row-level security decides who may read or change what — not this code.
const sb = supabase as any;

export type ActStatus = "planned" | "in_progress" | "completed" | "delayed" | "cancelled";
export const ACT_STATUS: { k: ActStatus; en: string; ne: string }[] = [
  { k: "planned", en: "Planned", ne: "योजना गरिएको" },
  { k: "in_progress", en: "In progress", ne: "चलिरहेको" },
  { k: "completed", en: "Completed", ne: "सम्पन्न" },
  { k: "delayed", en: "Delayed", ne: "ढिलो भएको" },
  { k: "cancelled", en: "Cancelled", ne: "रद्द" },
];
export const PLAN_STATUS: { k: string; en: string; ne: string }[] = [
  { k: "draft", en: "Draft", ne: "मस्यौदा" },
  { k: "submitted", en: "Submitted", ne: "पेस गरिएको" },
  { k: "approved", en: "Approved", ne: "स्वीकृत" },
  { k: "rejected", en: "Rejected", ne: "अस्वीकृत" },
];

export type AcademicYear = { id: string; name: string; is_active: boolean };
export type Overview = {
  plans: number; plansByStatus: Record<string, number>;
  activities: number; activitiesByStatus: Record<string, number>;
  avgProgress: number;
};

function nice(e: any): string {
  const m = String(e?.message ?? e ?? "");
  if (e?.code === "42P01" || /does not exist|schema cache|relation/i.test(m)) return "Department Management is not set up yet: the administrator must run docs/phase6/40_dept_mgmt.sql in Supabase.";
  if (e?.code === "P0001") return m;
  return friendly(e);
}

export async function loadYears(): Promise<R<AcademicYear[]>> {
  try {
    const { data, error } = await sb.from("academic_years").select("id,name,is_active").order("created_at");
    return error ? { ok: false, error: nice(error) } : { ok: true, data: data ?? [] };
  } catch (e) { return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` }; }
}

/** Counts for the dashboard, calculated from the saved records of one department and one academic year. */
export async function loadOverview(departmentId: string, year: string): Promise<R<Overview>> {
  try {
    const [p, a] = await Promise.all([
      sb.from("dm_plans").select("id,status").eq("department_id", departmentId).eq("academic_year", year),
      sb.from("dm_activities").select("id,status,progress_pct").eq("department_id", departmentId).eq("academic_year", year),
    ]);
    if (p.error) return { ok: false, error: nice(p.error) };
    if (a.error) return { ok: false, error: nice(a.error) };
    const count = (rows: { status: string }[]) => rows.reduce<Record<string, number>>((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m; }, {});
    const acts: { status: string; progress_pct: number }[] = a.data ?? [];
    return { ok: true, data: {
      plans: (p.data ?? []).length, plansByStatus: count(p.data ?? []),
      activities: acts.length, activitiesByStatus: count(acts),
      avgProgress: acts.length ? Math.round(acts.reduce((s, r) => s + (r.progress_pct || 0), 0) / acts.length) : 0,
    } };
  } catch (e) { return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` }; }
}

// ---------- annual plans ----------
export type DmPlan = {
  id: string; department_id: string; academic_year: string; title: string;
  objectives: string; expected_outcomes: string; indicators: string; targets: string;
  estimated_budget: number; funding_source: string; start_date: string; end_date: string;
  status: "draft" | "submitted" | "approved" | "rejected"; approval_comment: string;
  approved_by: string | null; approved_at: string | null; version: number;
  created_at: string; updated_at: string;
};
export type PlanForm = Pick<DmPlan, "title" | "objectives" | "expected_outcomes" | "indicators" | "targets" | "estimated_budget" | "funding_source" | "start_date" | "end_date">;
export type PlanRevision = { id: string; version: number; snapshot: Partial<DmPlan>; changed_at: string };

async function run<T>(p: PromiseLike<{ data: any; error: any }>, pick: (d: any) => T): Promise<R<T>> {
  try { const { data, error } = await p; return error ? { ok: false, error: nice(error) } : { ok: true, data: pick(data) }; }
  catch (e) { return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` }; }
}
const norm = (r: any): DmPlan => ({ ...r, estimated_budget: Number(r.estimated_budget ?? 0) });

export const loadPlans = (dept: string, year: string) =>
  run(sb.from("dm_plans").select("*").eq("department_id", dept).eq("academic_year", year).order("created_at", { ascending: false }), (d) => (d ?? []).map(norm) as DmPlan[]);
export const loadRevisions = (planId: string) =>
  run(sb.from("dm_plan_revisions").select("id,version,snapshot,changed_at").eq("plan_id", planId).order("version", { ascending: false }), (d) => (d ?? []) as PlanRevision[]);
export const createPlan = (dept: string, year: string, f: PlanForm) =>
  run(sb.from("dm_plans").insert({ department_id: dept, academic_year: year, ...f }).select("id").single(), (d) => d?.id as string);
export const updatePlan = (id: string, f: PlanForm) => run(sb.from("dm_plans").update(f).eq("id", id), () => true);
export const setPlanStatus = (id: string, status: DmPlan["status"], comment = "") =>
  run(sb.from("dm_plans").update({ status, approval_comment: comment }).eq("id", id), () => true);
export const deletePlan = (id: string) => run(sb.from("dm_plans").delete().eq("id", id), () => true);
