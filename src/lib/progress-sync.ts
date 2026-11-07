import { supabase } from "@/integrations/supabase/client";
import { bsToAd } from "@/lib/bs";
import { studentsOf, type Data } from "@/lib/store";

const sb = supabase as any;
const DAY = 24 * 60 * 60 * 1000;

/** "2083/84" → 2083 (श्रावण १ = BS month 04) */
export const yearNumber = (yearName: string) => {
  const y = parseInt(yearName, 10);
  return Number.isFinite(y) ? y : null;
};

/** शैक्षिक वर्षको अपेक्षित प्रगति (श्रावण १ देखि अर्को श्रावण १ सम्म) */
export function yearProgress(yearName: string, now = new Date()) {
  const Y = yearNumber(yearName);
  if (Y === null) return null;
  const start = bsToAd(`${Y}-04-01`).getTime();
  const end = bsToAd(`${Y + 1}-04-01`).getTime();
  const total = Math.max(1, Math.round((end - start) / DAY));
  const elapsed = Math.min(total, Math.max(0, Math.floor((now.getTime() - start) / DAY)));
  return { expectedPct: Math.round((elapsed / total) * 100), elapsed, total };
}

export type ProgressRow = {
  teacher_user_id: string;
  teacher_name: string;
  department_id: string | null;
  academic_year: string;
  local_class_id: string;
  class_name: string;
  subject: string;
  students_count: number;
  lh_total: number;
  lh_done: number;
  plans_total: number;
  plans_approved: number;
  last_diary: string | null;
  updated_at: string;
};

/** शिक्षकको स्थानीय डेटाबाट कक्षा-स्तरको सारांश बनाउँछ */
export function buildOwnProgress(params: {
  data: Data;
  userId: string;
  teacherName: string;
  departmentId: string | null;
  yearName: string;
}): ProgressRow[] {
  const { data, userId, teacherName, departmentId, yearName } = params;
  const now = new Date().toISOString();
  return (data.classes || [])
    .filter((c) => !c.closed)
    .map((c) => {
      const diary = (data.diary || []).filter((d) => d.classId === c.id);
      const plans = (data.plans || []).filter((p) => p.classId === c.id);
      const lastDiary = diary.reduce<string | null>((m, d) => (!m || d.date > m ? d.date : m), null);
      return {
        teacher_user_id: userId,
        teacher_name: teacherName,
        department_id: departmentId,
        academic_year: yearName,
        local_class_id: c.id,
        class_name: c.name,
        subject: c.subject || "",
        students_count: studentsOf(c).length,
        lh_total: Number(c.totalLh) || 0,
        lh_done: diary.reduce((s, d) => s + (Number(d.lh) || 0), 0),
        plans_total: plans.length,
        plans_approved: plans.filter((p) => p.status === "approved").length,
        last_diary: lastDiary,
        updated_at: now,
      };
    });
}

/** Upsert own rows; remove rows of this teacher/year whose class no longer exists */
export async function syncOwnProgress(userId: string, yearName: string, rows: ProgressRow[]) {
  if (rows.length) {
    const { error } = await sb
      .from("class_progress_snapshots")
      .upsert(rows, { onConflict: "teacher_user_id,academic_year,local_class_id" });
    if (error) throw error;
  }
  const keep = new Set(rows.map((r) => r.local_class_id));
  const { data: existing, error: selErr } = await sb
    .from("class_progress_snapshots")
    .select("id,local_class_id")
    .eq("teacher_user_id", userId)
    .eq("academic_year", yearName);
  if (selErr) throw selErr;
  const stale = ((existing ?? []) as { id: string; local_class_id: string }[])
    .filter((r) => !keep.has(r.local_class_id))
    .map((r) => r.id);
  if (stale.length) {
    const { error } = await sb.from("class_progress_snapshots").delete().in("id", stale);
    if (error) throw error;
  }
}

/** विभाग प्रमुख/admin को लागि: विभाग र वर्ष अनुसार सबै शिक्षकका कक्षा */
export async function loadDeptProgress(departmentId: string, yearName: string): Promise<ProgressRow[]> {
  const { data, error } = await sb
    .from("class_progress_snapshots")
    .select("*")
    .eq("department_id", departmentId)
    .eq("academic_year", yearName)
    .order("teacher_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProgressRow[];
}

export type ClassStatus = "not_started" | "on_time" | "slow" | "behind" | "inactive";

/** स्थिति: अपेक्षित प्रगतिको तुलनामा वास्तविक प्रगति */
export function classStatus(row: ProgressRow, expectedPct: number, now = new Date()): ClassStatus {
  if (row.lh_done <= 0 && !row.last_diary) return "not_started";
  if (row.last_diary) {
    const days = Math.floor((now.getTime() - bsToAd(row.last_diary).getTime()) / DAY);
    if (days > 14) return "inactive";
  }
  const actual = row.lh_total > 0 ? Math.min(100, Math.round((row.lh_done / row.lh_total) * 100)) : 0;
  if (actual >= expectedPct - 5) return "on_time";
  if (actual >= expectedPct - 20) return "slow";
  return "behind";
}

export const STATUS_META: Record<ClassStatus, { en: string; ne: string; cls: string }> = {
  on_time: { en: "On time", ne: "समयमा", cls: "bg-emerald-600 text-white" },
  slow: { en: "Slow", ne: "ढिलो", cls: "bg-amber-400 text-amber-950" },
  behind: { en: "Behind", ne: "पछाडि", cls: "bg-red-600 text-white" },
  inactive: { en: "Inactive", ne: "निष्क्रिय (१४ दिन+)", cls: "bg-slate-500 text-white" },
  not_started: { en: "Not started", ne: "सुरु भएको छैन", cls: "bg-muted text-muted-foreground" },
};
