import { supabase } from "@/integrations/supabase/client";
import { friendly, type R } from "@/lib/sqc-data";

// Department Management (docs/phase6/40_dept_mgmt.sql & 41_dept_evidence_storage.sql).
// Every call runs WITH the signed-in user's login, so the database's row-level security
// decides who may read or change what — not this code.
const sb = supabase as any;

export type ActStatus = "planned" | "in_progress" | "completed" | "delayed" | "cancelled";
export const ACT_STATUS: { k: ActStatus; en: string; ne: string }[] = [
  { k: "planned", en: "Planned", ne: "योजना गरिएको" },
  { k: "in_progress", en: "In progress", ne: "चलिरहेको" },
  { k: "completed", en: "Completed", ne: "सम्पन्न" },
  { k: "delayed", en: "Delayed", ne: "ढिलो भएको" },
  { k: "cancelled", en: "Cancelled", ne: "रद्द" },
];

export const ACT_CATEGORIES: { k: string; en: string; ne: string }[] = [
  { k: "academic", en: "Academic / Teaching", ne: "शैक्षिक / शिक्षण" },
  { k: "research", en: "Research / Publication", ne: "अनुसन्धान / प्रकाशन" },
  { k: "training", en: "Workshop / Training", ne: "कार्यशाला / तालिम" },
  { k: "seminar", en: "Seminar / Conference", ne: "सेमिनार / गोष्ठी" },
  { k: "student", en: "Student Support / ECA", ne: "विद्यार्थी सहयोग / अतिरिक्त क्रियाकलाप" },
  { k: "exam", en: "Evaluation / Exam", ne: "मूल्याङ्कन / परीक्षा" },
  { k: "community", en: "Community / Outreach", ne: "सामुदायिक कार्यक्रम" },
  { k: "other", en: "Other", ne: "अन्य" },
];

export const PLAN_STATUS: { k: string; en: string; ne: string }[] = [
  { k: "draft", en: "Draft", ne: "मस्यौदा" },
  { k: "submitted", en: "Submitted", ne: "पेस गरिएको" },
  { k: "approved", en: "Approved", ne: "स्वीकृत" },
  { k: "rejected", en: "Rejected", ne: "अस्वीकृत" },
];

export const LINE_STATUS = PLAN_STATUS;

export const REV_STATUS: { k: string; en: string; ne: string }[] = [
  { k: "pending", en: "Pending", ne: "विचाराधीन" },
  { k: "approved", en: "Approved", ne: "स्वीकृत" },
  { k: "rejected", en: "Rejected", ne: "अस्वीकृत" },
];

export type AcademicYear = { id: string; name: string; is_active: boolean };
export type Overview = {
  plans: number;
  plansByStatus: Record<string, number>;
  activities: number;
  activitiesByStatus: Record<string, number>;
  avgProgress: number;
  budgetProposed: number;
  budgetApproved: number;
  budgetSpent: number;
  budgetRemaining: number;
  pendingRevisions: number;
};

export function niceDmError(e: any): string {
  const m = String(e?.message ?? e ?? "");
  if (e?.code === "42P01" || /does not exist|schema cache|relation/i.test(m)) {
    return "Department Management is not set up yet: the administrator must run docs/phase6/40_dept_mgmt.sql in Supabase.";
  }
  if (/bucket.*not found|dept-evidence/i.test(m)) {
    return "Evidence storage bucket is not set up yet: the administrator must run docs/phase6/41_dept_evidence_storage.sql in Supabase.";
  }
  if (e?.code === "P0001") return m;
  return friendly(e);
}

async function run<T>(p: PromiseLike<{ data: any; error: any }>, pick: (d: any) => T): Promise<R<T>> {
  try {
    const { data, error } = await p;
    return error ? { ok: false, error: niceDmError(error) } : { ok: true, data: pick(data) };
  } catch (e) {
    return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` };
  }
}

export async function loadYears(): Promise<R<AcademicYear[]>> {
  return run(sb.from("academic_years").select("id,name,is_active").order("created_at"), (d) => d ?? []);
}

/** Counts for the dashboard, calculated from the saved records of one department and one academic year. */
export async function loadOverview(departmentId: string, year: string, includeBudget = false): Promise<R<Overview>> {
  try {
    const [p, a] = await Promise.all([
      sb.from("dm_plans").select("id,status").eq("department_id", departmentId).eq("academic_year", year),
      sb.from("dm_activities").select("id,status,progress_pct").eq("department_id", departmentId).eq("academic_year", year),
    ]);
    if (p.error) return { ok: false, error: niceDmError(p.error) };
    if (a.error) return { ok: false, error: niceDmError(a.error) };

    const count = (rows: { status: string }[]) =>
      rows.reduce<Record<string, number>>((m, r) => {
        m[r.status] = (m[r.status] ?? 0) + 1;
        return m;
      }, {});
    const acts: { id: string; status: string; progress_pct: number }[] = a.data ?? [];
    const planIds = new Set<string>((p.data ?? []).map((x: any) => x.id));
    const actIds = new Set<string>(acts.map((x) => x.id));

    let budgetProposed = 0;
    let budgetApproved = 0;
    let budgetSpent = 0;
    let pendingRevisions = 0;

    if (includeBudget) {
      const [bl, ex] = await Promise.all([
        sb.from("dm_budget_lines").select("id,plan_id,activity_id,proposed,approved,status").eq("department_id", departmentId),
        sb.from("dm_expenses").select("id,line_id,plan_id,activity_id,expense_date,amount").eq("department_id", departmentId),
      ]);
      if (!bl.error && bl.data) {
        const yearLines = (bl.data as any[]).filter(
          (l) => (!l.plan_id && !l.activity_id) || (l.plan_id && planIds.has(l.plan_id)) || (l.activity_id && actIds.has(l.activity_id))
        );
        const lineIds = new Set<string>(yearLines.map((l) => l.id));
        for (const l of yearLines) {
          budgetProposed += Number(l.proposed ?? 0);
          if (l.status === "approved") budgetApproved += Number(l.approved ?? 0);
        }
        if (!ex.error && ex.data) {
          const yearPrefix = year.slice(0, 4);
          for (const e of ex.data as any[]) {
            const matchYear =
              (e.line_id && lineIds.has(e.line_id)) ||
              (e.plan_id && planIds.has(e.plan_id)) ||
              (e.activity_id && actIds.has(e.activity_id)) ||
              (!e.line_id && !e.plan_id && !e.activity_id && (!yearPrefix || String(e.expense_date ?? "").startsWith(yearPrefix)));
            if (matchYear) budgetSpent += Number(e.amount ?? 0);
          }
        }
        if (lineIds.size > 0) {
          const rv = await sb.from("dm_budget_revisions").select("id,line_id,status").eq("status", "pending");
          if (!rv.error && rv.data) {
            pendingRevisions = (rv.data as any[]).filter((r) => lineIds.has(r.line_id)).length;
          }
        }
      }
    }

    return {
      ok: true,
      data: {
        plans: (p.data ?? []).length,
        plansByStatus: count(p.data ?? []),
        activities: acts.length,
        activitiesByStatus: count(acts),
        avgProgress: acts.length ? Math.round(acts.reduce((s, r) => s + (r.progress_pct || 0), 0) / acts.length) : 0,
        budgetProposed,
        budgetApproved,
        budgetSpent,
        budgetRemaining: budgetApproved - budgetSpent,
        pendingRevisions,
      },
    };
  } catch (e) {
    return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` };
  }
}

// ---------- Stage 2: Annual plans ----------
export type DmPlan = {
  id: string;
  department_id: string;
  academic_year: string;
  title: string;
  objectives: string;
  expected_outcomes: string;
  indicators: string;
  targets: string;
  estimated_budget: number;
  funding_source: string;
  start_date: string;
  end_date: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  approval_comment: string;
  approved_by: string | null;
  approved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
export type PlanForm = Pick<
  DmPlan,
  "title" | "objectives" | "expected_outcomes" | "indicators" | "targets" | "estimated_budget" | "funding_source" | "start_date" | "end_date"
>;
export type PlanRevision = { id: string; version: number; snapshot: Partial<DmPlan>; changed_at: string };

const normPlan = (r: any): DmPlan => ({ ...r, estimated_budget: Number(r.estimated_budget ?? 0) });

export const loadPlans = (dept: string, year: string) =>
  run(
    sb.from("dm_plans").select("*").eq("department_id", dept).eq("academic_year", year).order("created_at", { ascending: false }),
    (d) => (d ?? []).map(normPlan) as DmPlan[]
  );
export const loadRevisions = (planId: string) =>
  run(
    sb.from("dm_plan_revisions").select("id,version,snapshot,changed_at").eq("plan_id", planId).order("version", { ascending: false }),
    (d) => (d ?? []) as PlanRevision[]
  );
export const createPlan = (dept: string, year: string, f: PlanForm) =>
  run(sb.from("dm_plans").insert({ department_id: dept, academic_year: year, ...f }).select("id").single(), (d) => d?.id as string);
export const updatePlan = (id: string, f: PlanForm) => run(sb.from("dm_plans").update(f).eq("id", id), () => true);
export const setPlanStatus = (id: string, status: DmPlan["status"], comment = "") =>
  run(sb.from("dm_plans").update({ status, approval_comment: comment }).eq("id", id), () => true);
export const deletePlan = (id: string) => run(sb.from("dm_plans").delete().eq("id", id), () => true);

// ---------- Stage 3: Activities, Progress & Evidence ----------
export type DmActivity = {
  id: string;
  department_id: string;
  plan_id: string | null;
  academic_year: string;
  title: string;
  category: string;
  activity_date: string;
  deadline: string;
  responsible_user_id: string | null;
  responsible_name: string;
  participants: string;
  planned_output: string;
  actual_output: string;
  status: ActStatus;
  progress_pct: number;
  budget_amount: number;
  challenges: string;
  corrective_actions: string;
  next_steps: string;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type ActivityForm = Pick<
  DmActivity,
  | "plan_id"
  | "title"
  | "category"
  | "activity_date"
  | "deadline"
  | "responsible_user_id"
  | "responsible_name"
  | "participants"
  | "planned_output"
  | "actual_output"
  | "status"
  | "progress_pct"
  | "budget_amount"
  | "challenges"
  | "corrective_actions"
  | "next_steps"
>;

export type ActivityProgressPatch = Pick<
  DmActivity,
  "actual_output" | "status" | "progress_pct" | "challenges" | "corrective_actions" | "next_steps"
>;

export type DeptTeacher = { user_id: string; name: string; designation: string; dept: string };

const normAct = (r: any): DmActivity => ({
  ...r,
  plan_id: r.plan_id ?? null,
  responsible_user_id: r.responsible_user_id ?? null,
  progress_pct: Number(r.progress_pct ?? 0),
  budget_amount: Number(r.budget_amount ?? 0),
});

export const loadActivities = (dept: string, year: string) =>
  run(
    sb.from("dm_activities").select("*").eq("department_id", dept).eq("academic_year", year).order("created_at", { ascending: false }),
    (d) => (d ?? []).map(normAct) as DmActivity[]
  );

export const createActivity = (dept: string, year: string, f: ActivityForm) =>
  run(
    sb
      .from("dm_activities")
      .insert({
        department_id: dept,
        academic_year: year,
        ...f,
        plan_id: f.plan_id || null,
        responsible_user_id: f.responsible_user_id || null,
        progress_pct: Math.min(100, Math.max(0, Math.round(Number(f.progress_pct) || 0))),
        budget_amount: Math.max(0, Number(f.budget_amount) || 0),
      })
      .select("id")
      .single(),
    (d) => d?.id as string
  );

export const updateActivity = (id: string, f: ActivityForm) =>
  run(
    sb
      .from("dm_activities")
      .update({
        ...f,
        plan_id: f.plan_id || null,
        responsible_user_id: f.responsible_user_id || null,
        progress_pct: Math.min(100, Math.max(0, Math.round(Number(f.progress_pct) || 0))),
        budget_amount: Math.max(0, Number(f.budget_amount) || 0),
      })
      .eq("id", id),
    () => true
  );

/** Specifically updates only progress columns so a responsible teacher can update their assigned activity under dm_activities_guard(). */
export const updateActivityProgress = (id: string, p: ActivityProgressPatch) =>
  run(
    sb
      .from("dm_activities")
      .update({
        actual_output: p.actual_output,
        status: p.status,
        progress_pct: Math.min(100, Math.max(0, Math.round(Number(p.progress_pct) || 0))),
        challenges: p.challenges,
        corrective_actions: p.corrective_actions,
        next_steps: p.next_steps,
      })
      .eq("id", id),
    () => true
  );

export const deleteActivity = (id: string) => run(sb.from("dm_activities").delete().eq("id", id), () => true);

/** Loads teachers in the department (uses dm_dept_teachers RPC if installed, falling back to readable profiles). */
export async function loadDeptTeachers(deptId: string, deptName = ""): Promise<DeptTeacher[]> {
  try {
    const rpc = await sb.rpc("dm_dept_teachers", { _dept: deptId });
    if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
      return rpc.data.map((r: any) => ({
        user_id: r.user_id,
        name: r.name ?? "",
        designation: r.designation ?? "",
        dept: r.dept ?? "",
      }));
    }
  } catch {
    /* fallback below */
  }
  try {
    const { data, error } = await sb.from("profiles").select("id,name,designation,dept").order("name");
    if (error || !data) return [];
    const dn = deptName.trim().toLowerCase();
    const all = (data as any[]).map((p) => ({
      user_id: p.id,
      name: p.name ?? "",
      designation: p.designation ?? "",
      dept: p.dept ?? "",
    }));
    const matched = dn ? all.filter((p) => p.dept.trim().toLowerCase() === dn) : [];
    return matched.length > 0 ? matched : all;
  } catch {
    return [];
  }
}

// ---------- Evidence files (docs/phase6/41_dept_evidence_storage.sql) ----------
export type DmEvidence = {
  id: string;
  department_id: string;
  activity_id: string | null;
  expense_id: string | null;
  file_path: string;
  file_name: string;
  mime: string;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_at: string;
};

export const ALLOWED_EVIDENCE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // 10 MB

export const loadEvidence = (dept: string) =>
  run(
    sb.from("dm_evidence").select("*").eq("department_id", dept).order("uploaded_at", { ascending: false }),
    (d) => (d ?? []) as DmEvidence[]
  );

export async function uploadEvidence(opts: {
  dept: string;
  activityId?: string | null;
  expenseId?: string | null;
  file: File;
}): Promise<R<DmEvidence>> {
  const { dept, activityId = null, expenseId = null, file } = opts;
  if (!file) return { ok: false, error: "Please choose a file to upload." };
  if (file.size > MAX_EVIDENCE_BYTES) {
    return { ok: false, error: "File is too large (maximum 10 MB allowed)." };
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_EVIDENCE_MIMES.includes(mime)) {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF, TXT, Word (.docx) or Excel (.xlsx).",
    };
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "evidence";
  const path = `${dept}/${Date.now()}-${safeName}`;
  try {
    const up = await sb.storage.from("dept-evidence").upload(path, file, { contentType: mime, upsert: false });
    if (up.error) return { ok: false, error: niceDmError(up.error) };
    const ins = await sb
      .from("dm_evidence")
      .insert({
        department_id: dept,
        activity_id: activityId || null,
        expense_id: expenseId || null,
        file_path: path,
        file_name: file.name,
        mime,
        size_bytes: file.size,
      })
      .select("*")
      .single();
    if (ins.error) {
      void sb.storage.from("dept-evidence").remove([path]);
      return { ok: false, error: niceDmError(ins.error) };
    }
    return { ok: true, data: ins.data as DmEvidence };
  } catch (e) {
    return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` };
  }
}

export async function getEvidenceUrl(filePath: string): Promise<R<string>> {
  try {
    const { data, error } = await sb.storage.from("dept-evidence").createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) return { ok: false, error: niceDmError(error ?? "Could not open file.") };
    return { ok: true, data: data.signedUrl };
  } catch (e) {
    return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` };
  }
}

export async function deleteEvidence(ev: DmEvidence): Promise<R<boolean>> {
  const del = await run(sb.from("dm_evidence").delete().eq("id", ev.id), () => true);
  if (del.ok && ev.file_path) {
    try {
      await sb.storage.from("dept-evidence").remove([ev.file_path]);
    } catch {
      /* ignore storage cleanup failure */
    }
  }
  return del;
}

// ---------- Stage 4: Budget lines, Revisions & Expenses ----------
export type DmBudgetLine = {
  id: string;
  department_id: string;
  plan_id: string | null;
  activity_id: string | null;
  title: string;
  proposed: number;
  approved: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  comment: string;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type BudgetLineForm = {
  plan_id: string | null;
  activity_id: string | null;
  title: string;
  proposed: number;
  approved?: number;
  status?: DmBudgetLine["status"];
  comment?: string;
};

export type DmBudgetRevision = {
  id: string;
  line_id: string;
  requested_amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_comment: string;
};

export type DmExpense = {
  id: string;
  department_id: string;
  line_id: string | null;
  plan_id: string | null;
  activity_id: string | null;
  expense_date: string;
  description: string;
  amount: number;
  voucher_no: string;
  reversal_of: string | null;
  locked: boolean;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type ExpenseForm = {
  line_id: string | null;
  plan_id: string | null;
  activity_id: string | null;
  expense_date: string;
  description: string;
  amount: number;
  voucher_no: string;
  reversal_of?: string | null;
};

const normLine = (r: any): DmBudgetLine => ({
  ...r,
  plan_id: r.plan_id ?? null,
  activity_id: r.activity_id ?? null,
  proposed: Number(r.proposed ?? 0),
  approved: Number(r.approved ?? 0),
});

const normRev = (r: any): DmBudgetRevision => ({
  ...r,
  requested_amount: Number(r.requested_amount ?? 0),
});

const normExp = (r: any): DmExpense => ({
  ...r,
  line_id: r.line_id ?? null,
  plan_id: r.plan_id ?? null,
  activity_id: r.activity_id ?? null,
  reversal_of: r.reversal_of ?? null,
  amount: Number(r.amount ?? 0),
  locked: Boolean(r.locked),
});

export const loadBudgetLines = (dept: string) =>
  run(
    sb.from("dm_budget_lines").select("*").eq("department_id", dept).order("created_at", { ascending: false }),
    (d) => (d ?? []).map(normLine) as DmBudgetLine[]
  );

export const createBudgetLine = (dept: string, f: BudgetLineForm) =>
  run(
    sb
      .from("dm_budget_lines")
      .insert({
        department_id: dept,
        plan_id: f.plan_id || null,
        activity_id: f.activity_id || null,
        title: f.title.trim(),
        proposed: Math.max(0, Number(f.proposed) || 0),
        ...(f.approved !== undefined ? { approved: Math.max(0, Number(f.approved) || 0) } : {}),
        ...(f.status ? { status: f.status } : {}),
        comment: f.comment ?? "",
      })
      .select("id")
      .single(),
    (d) => d?.id as string
  );

export const updateBudgetLine = (id: string, f: BudgetLineForm) =>
  run(
    sb
      .from("dm_budget_lines")
      .update({
        plan_id: f.plan_id || null,
        activity_id: f.activity_id || null,
        title: f.title.trim(),
        proposed: Math.max(0, Number(f.proposed) || 0),
        ...(f.approved !== undefined ? { approved: Math.max(0, Number(f.approved) || 0) } : {}),
        ...(f.status ? { status: f.status } : {}),
        ...(f.comment !== undefined ? { comment: f.comment } : {}),
      })
      .eq("id", id),
    () => true
  );

export const setBudgetLineStatus = (
  id: string,
  status: DmBudgetLine["status"],
  opts?: { approved?: number; comment?: string }
) =>
  run(
    sb
      .from("dm_budget_lines")
      .update({
        status,
        ...(opts?.approved !== undefined ? { approved: Math.max(0, Number(opts.approved) || 0) } : {}),
        ...(opts?.comment !== undefined ? { comment: opts.comment } : {}),
      })
      .eq("id", id),
    () => true
  );

export const deleteBudgetLine = (id: string) =>
  run(sb.from("dm_budget_lines").delete().eq("id", id), () => true);

export async function loadBudgetRevisions(lineIds: string[]): Promise<R<DmBudgetRevision[]>> {
  if (!lineIds.length) return { ok: true, data: [] };
  return run(
    sb.from("dm_budget_revisions").select("*").in("line_id", lineIds).order("requested_at", { ascending: false }),
    (d) => (d ?? []).map(normRev) as DmBudgetRevision[]
  );
}

export const requestBudgetRevision = (lineId: string, requestedAmount: number, reason: string) =>
  run(
    sb.from("dm_budget_revisions").insert({
      line_id: lineId,
      requested_amount: Math.max(0, Number(requestedAmount) || 0),
      reason: reason.trim(),
      status: "pending",
    }),
    () => true
  );

export const decideBudgetRevision = (revisionId: string, approve: boolean, comment = "") =>
  run(
    sb.rpc("dm_budget_decide_revision", { _id: revisionId, _approve: approve, _comment: comment }),
    () => true
  );

export const loadExpenses = (dept: string) =>
  run(
    sb.from("dm_expenses").select("*").eq("department_id", dept).order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
    (d) => (d ?? []).map(normExp) as DmExpense[]
  );

export const createExpense = (dept: string, f: ExpenseForm) =>
  run(
    sb
      .from("dm_expenses")
      .insert({
        department_id: dept,
        line_id: f.line_id || null,
        plan_id: f.plan_id || null,
        activity_id: f.activity_id || null,
        expense_date: f.expense_date,
        description: f.description.trim(),
        amount: Number(f.amount),
        voucher_no: f.voucher_no.trim(),
        reversal_of: f.reversal_of || null,
      })
      .select("id")
      .single(),
    (d) => d?.id as string
  );

export const updateExpense = (id: string, f: ExpenseForm) =>
  run(
    sb
      .from("dm_expenses")
      .update({
        line_id: f.line_id || null,
        plan_id: f.plan_id || null,
        activity_id: f.activity_id || null,
        expense_date: f.expense_date,
        description: f.description.trim(),
        amount: Number(f.amount),
        voucher_no: f.voucher_no.trim(),
      })
      .eq("id", id),
    () => true
  );

export const setExpenseLocked = (id: string, locked: boolean) =>
  run(sb.from("dm_expenses").update({ locked }).eq("id", id), () => true);

export const deleteExpense = (id: string) =>
  run(sb.from("dm_expenses").delete().eq("id", id), () => true);

/** Quick summary of actionable items for the Home dashboard (Admin / HOD / Teacher). */
export type ActionSummary = {
  submittedPlans: number;
  pendingBudgetLines: number;
  pendingRevisions: number;
  myAssignedActivities: number;
  pendingSqcReports: number;
};

export async function loadActionSummary(userId: string, isAdmin: boolean, headDeptIds: string[]): Promise<ActionSummary> {
  const out: ActionSummary = {
    submittedPlans: 0,
    pendingBudgetLines: 0,
    pendingRevisions: 0,
    myAssignedActivities: 0,
    pendingSqcReports: 0,
  };
  try {
    const tasks: Promise<void>[] = [];
    if (isAdmin) {
      tasks.push(
        (async () => {
          const [pl, bl, rv, sq] = await Promise.all([
            sb.from("dm_plans").select("id").eq("status", "submitted"),
            sb.from("dm_budget_lines").select("id").eq("status", "submitted"),
            sb.from("dm_budget_revisions").select("id").eq("status", "pending"),
            sb.from("sqc_reports").select("id").in("status", ["Submitted", "Under Review", "In Progress"]),
          ]);
          if (!pl.error && pl.data) out.submittedPlans = pl.data.length;
          if (!bl.error && bl.data) out.pendingBudgetLines = bl.data.length;
          if (!rv.error && rv.data) out.pendingRevisions = rv.data.length;
          if (!sq.error && sq.data) out.pendingSqcReports = sq.data.length;
        })()
      );
    } else if (headDeptIds.length > 0) {
      tasks.push(
        (async () => {
          const [pl, bl] = await Promise.all([
            sb.from("dm_plans").select("id").in("department_id", headDeptIds).eq("status", "draft"),
            sb.from("dm_budget_lines").select("id").in("department_id", headDeptIds).eq("status", "draft"),
          ]);
          if (!pl.error && pl.data) out.submittedPlans = pl.data.length;
          if (!bl.error && bl.data) out.pendingBudgetLines = bl.data.length;
        })()
      );
    }
    tasks.push(
      (async () => {
        const ac = await sb
          .from("dm_activities")
          .select("id,status")
          .eq("responsible_user_id", userId)
          .in("status", ["planned", "in_progress", "delayed"]);
        if (!ac.error && ac.data) out.myAssignedActivities = ac.data.length;
      })()
    );
    await Promise.all(tasks);
  } catch {
    /* ignore if tables are not installed yet */
  }
  return out;
}
