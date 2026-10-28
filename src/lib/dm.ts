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
