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

// =========================================================================
// BATCH 7: CAMPUS ANNUAL CALENDAR & CLASS-WISE ACADEMIC CALENDARS (Matrix)
// =========================================================================

export type CampusCalType = {
  id: string;
  name: string;
  color: string;
  is_holiday: boolean;
};

export const DEFAULT_CAL_TYPES_LIST: { name: string; color: string; is_holiday: boolean }[] = [
  { name: "Regular classes", color: "slate", is_holiday: false },
  { name: "First-Term Examination", color: "amber", is_holiday: false },
  { name: "Second-Term Examination", color: "amber", is_holiday: false },
  { name: "Third-Term Examination", color: "amber", is_holiday: false },
  { name: "Final / Board Exam", color: "rose", is_holiday: false },
  { name: "Dashain–Tihar holiday", color: "red", is_holiday: true },
  { name: "Winter holiday", color: "sky", is_holiday: true },
  { name: "Summer holiday", color: "orange", is_holiday: true },
  { name: "Public holiday", color: "red", is_holiday: true },
  { name: "Course Orientation", color: "blue", is_holiday: false },
  { name: "Result & Prize Distribution", color: "emerald", is_holiday: false },
  { name: "Remedial Classes", color: "purple", is_holiday: false },
  { name: "Guest Lecture", color: "teal", is_holiday: false },
  { name: "Event / Activity", color: "blue", is_holiday: false },
];

export async function loadCalTypes(): Promise<CampusCalType[]> {
  try {
    const { data, error } = await sb.from("campus_cal_types").select("*").order("name");
    if (!error && Array.isArray(data) && data.length > 0) {
      return data as CampusCalType[];
    }
  } catch {
    /* fallback below */
  }
  return DEFAULT_CAL_TYPES_LIST.map((t, idx) => ({ id: `default-${idx}`, ...t }));
}

export async function addCalType(name: string, color = "blue", is_holiday = false): Promise<R<CampusCalType>> {
  const n = name.trim();
  if (!n) return { ok: false, error: "Type name is required." };
  return run(
    sb.from("campus_cal_types").insert({ name: n, color, is_holiday }).select("*").single(),
    (d) => d as CampusCalType
  );
}

export async function deleteCalType(id: string): Promise<R<boolean>> {
  return run(sb.from("campus_cal_types").delete().eq("id", id), () => true);
}

export type CampusAnnualEvent = {
  id: string;
  title: string;
  event_type: string;
  from_date: string;
  to_date: string | null;
  description: string;
  created_at?: string;
};

/**
 * Loads campus annual events:
 * 1. From campus_annual_calendar table in Supabase
 * 2. If table is empty or missing, looks up Admin user's teacher_data content.cal in cloud
 */
export async function loadCampusAnnualEvents(): Promise<CampusAnnualEvent[]> {
  try {
    const { data, error } = await sb.from("campus_annual_calendar").select("*").order("from_date", { ascending: true });
    if (!error && Array.isArray(data) && data.length > 0) {
      return data as CampusAnnualEvent[];
    }
  } catch {
    /* fallback below */
  }

  // Fallback: check admin's teacher_data in cloud
  try {
    const { data: adminRows } = await sb.from("user_roles").select("user_id").eq("role", "admin");
    if (Array.isArray(adminRows) && adminRows.length > 0) {
      const adminIds = adminRows.map((r: any) => r.user_id);
      const { data: td } = await sb.from("teacher_data").select("content").in("teacher_id", adminIds);
      if (Array.isArray(td)) {
        for (const row of td) {
          const cal = row?.content?.cal;
          if (Array.isArray(cal) && cal.length > 0) {
            return cal.map((c: any) => ({
              id: String(c.id || `cal-${Math.random()}`),
              title: String(c.title || c.type || "Campus Event"),
              event_type: String(c.type || "Event"),
              from_date: String(c.from || ""),
              to_date: c.to ? String(c.to) : null,
              description: "",
            }));
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function saveCampusAnnualEvent(ev: Omit<CampusAnnualEvent, "id"> & { id?: string }): Promise<R<CampusAnnualEvent>> {
  const payload = {
    title: ev.title.trim(),
    event_type: ev.event_type || "Event",
    from_date: ev.from_date,
    to_date: ev.to_date || null,
    description: ev.description?.trim() || "",
    updated_at: new Date().toISOString(),
  };
  return ev.id
    ? run(sb.from("campus_annual_calendar").update(payload).eq("id", ev.id).select("*").single(), (d) => d as CampusAnnualEvent)
    : run(sb.from("campus_annual_calendar").insert(payload).select("*").single(), (d) => d as CampusAnnualEvent);
}

export async function deleteCampusAnnualEvent(id: string): Promise<R<boolean>> {
  return run(sb.from("campus_annual_calendar").delete().eq("id", id), () => true);
}

// -------------------------------------------------------------
// Matrix Class-wise Academic Calendar (Matching the photo)
// -------------------------------------------------------------

export type CalendarMonthCol = {
  m0: number;       // 0-indexed month (0 = Baishakh, 6 = Kartik, 11 = Chaitra)
  bsMonth: number;  // 1-12
  nameEn: string;
  nameNe: string;
};

export type CalendarParticularRow = {
  id: string;
  title: string;
  type: "monthly" | "span";
  values: Record<string, string>; // month index or key -> "11th" or "16"
  spanText: string;               // for merged text spanning across months
  remarks: string;                // auto-sum or custom remark
  isTotalDays?: boolean;
  isTeachingDays?: boolean;
};

export type ClassAcademicCalendar = {
  id: string;
  department_id: string;
  academic_year: string;
  class_id: string;
  class_name: string;
  start_month: number; // 7 = Kartik, 1 = Baishakh
  end_month: number;   // 4 = Shrawan, 12 = Chaitra
  months: CalendarMonthCol[];
  particulars: CalendarParticularRow[];
  status: "draft" | "submitted" | "approved";
  approval_note: string;
  prepared_name: string;
  approved_name: string;
  approved_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export const BS_MONTH_INFO: { m0: number; bsMonth: number; en: string; ne: string }[] = [
  { m0: 0, bsMonth: 1, en: "Baishakh", ne: "बैशाख" },
  { m0: 1, bsMonth: 2, en: "Jestha", ne: "जेठ" },
  { m0: 2, bsMonth: 3, en: "Asad", ne: "असार" },
  { m0: 3, bsMonth: 4, en: "Shrawan", ne: "साउन" },
  { m0: 4, bsMonth: 5, en: "Bhadra", ne: "भदौ" },
  { m0: 5, bsMonth: 6, en: "Ashwin", ne: "असोज" },
  { m0: 6, bsMonth: 7, en: "Kartik", ne: "कार्तिक" },
  { m0: 7, bsMonth: 8, en: "Mangshir", ne: "मंसिर" },
  { m0: 8, bsMonth: 9, en: "Poush", ne: "पुस" },
  { m0: 9, bsMonth: 10, en: "Magh", ne: "माघ" },
  { m0: 10, bsMonth: 11, en: "Falgun", ne: "फागुन" },
  { m0: 11, bsMonth: 12, en: "Chaitra", ne: "चैत" },
];

/** Builds an ordered sequence of months from startMonth (e.g. 7 Kartik) to endMonth (e.g. 4 Shrawan). */
export function buildAcademicMonths(startMonth = 1, endMonth = 12): CalendarMonthCol[] {
  const result: CalendarMonthCol[] = [];
  let cur = startMonth;
  for (let i = 0; i < 12; i++) {
    const idx0 = (cur - 1) % 12;
    const info = BS_MONTH_INFO[idx0]!;
    result.push({ m0: info.m0, bsMonth: info.bsMonth, nameEn: info.en, nameNe: info.ne });
    if (cur === endMonth) break;
    cur = cur === 12 ? 1 : cur + 1;
  }
  return result;
}

/**
 * Default particulars matching the user's photo with verified spelling, grammar, and bilingual labels.
 */
export const DEFAULT_MATRIX_PARTICULARS: Omit<CalendarParticularRow, "id">[] = [
  { title: "Total Working Days · कुल कार्यदिन", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: true, isTeachingDays: false },
  { title: "Net Teaching Days · खुद शिक्षण दिन", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: true },
  { title: "Classes Start · कक्षा आरम्भ", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Course Orientation · पाठ्यक्रम अभिमुखीकरण", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "First-Term Examination · प्रथम त्रैमासिक परीक्षा", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Result Publication, Analysis and Prize Distribution of 1st Term · प्रथम त्रैमासिक नतिजा प्रकाशन, विश्लेषण तथा पुरस्कार वितरण", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Winter Vacation · हिउँदे बिदा", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Second-Term Examination · दोस्रो त्रैमासिक परीक्षा", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Result Publication, Analysis and Prize Distribution of 2nd Term · दोस्रो त्रैमासिक नतिजा प्रकाशन, विश्लेषण तथा पुरस्कार वितरण", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Remedial Classes Start as Needed · आवश्यकता अनुसार उपचारात्मक कक्षा सञ्चालन", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Guest Lecture · अतिथि व्याख्यान", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Third-Term Examination · तेस्रो त्रैमासिक परीक्षा", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Result Publication, Analysis and Prize Distribution of 3rd Term · तेस्रो त्रैमासिक नतिजा प्रकाशन, विश्लेषण तथा पुरस्कार वितरण", type: "monthly", values: {}, spanText: "", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Field Work / Project Work / Practical Orientation as Needed · फिल्ड वर्क / परियोजना कार्य / प्रयोगात्मक अभिमुखीकरण", type: "span", values: {}, spanText: "Within 2 weeks of TU Board Exam Completion", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Scholarship Distribution · छात्रवृत्ति वितरण", type: "span", values: {}, spanText: "Notice after completion of TU Board Exam Form Fill-up", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "TU Board Examination · त्रि.वि. वार्षिक परीक्षा", type: "span", values: {}, spanText: "As per TU Notice", remarks: "", isTotalDays: false, isTeachingDays: false },
  { title: "Practical Examination (if any) · प्रयोगात्मक परीक्षा (भएमा)", type: "span", values: {}, spanText: "Within 15 days of Completion of TU Board Examination", remarks: "", isTotalDays: false, isTeachingDays: false },
];

export function calcRowAutoSum(row: CalendarParticularRow, months: CalendarMonthCol[]): number {
  let sum = 0;
  if (!row.values || typeof row.values !== "object") return 0;
  for (const m of months) {
    const v = Number(row.values[String(m.bsMonth)] ?? row.values[m.nameEn] ?? 0);
    if (!isNaN(v)) sum += v;
  }
  return sum;
}

/** Robust normalization to guarantee months and particulars are always safe arrays and objects. */
export function normalizeCalendarRecord(d: any): ClassAcademicCalendar {
  if (!d || typeof d !== "object") {
    return {
      id: "",
      department_id: "",
      academic_year: "",
      class_id: "",
      class_name: "",
      start_month: 1,
      end_month: 12,
      months: buildAcademicMonths(1, 12),
      particulars: DEFAULT_MATRIX_PARTICULARS.map((p, idx) => ({ id: `row-${idx}`, ...p, values: { ...p.values } })),
      status: "draft",
      approval_note: "",
      prepared_name: "",
      approved_name: "",
      approved_at: null,
    };
  }

  let months = d.months;
  if (typeof months === "string") {
    try { months = JSON.parse(months); } catch { months = null; }
  }
  if (!Array.isArray(months) || months.length === 0) {
    months = buildAcademicMonths(Number(d.start_month) || 1, Number(d.end_month) || 12);
  }

  let parts = d.particulars;
  if (typeof parts === "string") {
    try { parts = JSON.parse(parts); } catch { parts = null; }
  }
  if (!Array.isArray(parts) || parts.length === 0) {
    parts = DEFAULT_MATRIX_PARTICULARS.map((p, idx) => ({ id: `row-${idx}`, ...p, values: { ...p.values } }));
  } else {
    parts = parts.map((p: any, idx: number) => ({
      id: String(p.id || `row-${idx}`),
      title: String(p.title || ""),
      type: p.type === "span" ? "span" : "monthly",
      values: p.values && typeof p.values === "object" ? p.values : {},
      spanText: String(p.spanText || ""),
      remarks: String(p.remarks || ""),
      isTotalDays: Boolean(p.isTotalDays),
      isTeachingDays: Boolean(p.isTeachingDays),
    }));
  }

  return {
    id: String(d.id || ""),
    department_id: String(d.department_id || ""),
    academic_year: String(d.academic_year || ""),
    class_id: String(d.class_id || ""),
    class_name: String(d.class_name || ""),
    start_month: Number(d.start_month) || 7,
    end_month: Number(d.end_month) || 4,
    months,
    particulars: parts,
    status: (d.status === "approved" || d.status === "submitted") ? d.status : "draft",
    approval_note: String(d.approval_note || ""),
    prepared_name: String(d.prepared_name || ""),
    approved_name: String(d.approved_name || ""),
    approved_at: d.approved_at || null,
  };
}

export async function loadClassCalendar(deptId: string, year: string, classId: string): Promise<R<ClassAcademicCalendar | null>> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deptId);
    let q = sb.from("dm_academic_calendars").select("*");
    if (isUuid) q = q.eq("department_id", deptId);
    if (year) q = q.eq("academic_year", year);
    if (classId) q = q.eq("class_id", classId);
    const { data, error } = await q.maybeSingle();
    if (error) {
      // Table doesn't exist yet or query failed - return null gracefully
      return { ok: true, data: null };
    }
    return { ok: true, data: data ? normalizeCalendarRecord(data) : null };
  } catch {
    return { ok: true, data: null };
  }
}

export async function loadAllClassCalendars(deptId: string, year: string): Promise<ClassAcademicCalendar[]> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deptId);
    let q = sb.from("dm_academic_calendars").select("*");
    if (isUuid) q = q.eq("department_id", deptId);
    if (year) q = q.eq("academic_year", year);
    const { data, error } = await q.order("class_name");
    if (!error && Array.isArray(data)) {
      return data.map(normalizeCalendarRecord);
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function saveClassCalendar(cal: Omit<ClassAcademicCalendar, "id"> & { id?: string }): Promise<R<ClassAcademicCalendar>> {
  const payload = {
    department_id: cal.department_id,
    academic_year: cal.academic_year,
    class_id: cal.class_id,
    class_name: cal.class_name,
    start_month: cal.start_month,
    end_month: cal.end_month,
    months: cal.months,
    particulars: cal.particulars,
    status: cal.status || "draft",
    approval_note: cal.approval_note || "",
    prepared_name: cal.prepared_name || "",
    approved_name: cal.approved_name || "",
    updated_at: new Date().toISOString(),
  };

  return cal.id
    ? run(
        sb.from("dm_academic_calendars").update(payload).eq("id", cal.id).select("*").single(),
        (d) => normalizeCalendarRecord(d)
      )
    : run(
        sb.from("dm_academic_calendars").insert(payload).select("*").single(),
        (d) => normalizeCalendarRecord(d)
      );
}

export async function setClassCalendarStatus(
  id: string,
  status: "draft" | "submitted" | "approved",
  approval_note = "",
  approved_name = ""
): Promise<R<boolean>> {
  const patch: Record<string, any> = {
    status,
    approval_note,
    updated_at: new Date().toISOString(),
  };
  if (status === "approved") {
    patch.approved_at = new Date().toISOString();
    if (approved_name) patch.approved_name = approved_name;
  }
  return run(sb.from("dm_academic_calendars").update(patch).eq("id", id), () => true);
}

export async function deleteClassCalendar(id: string): Promise<R<boolean>> {
  return run(sb.from("dm_academic_calendars").delete().eq("id", id), () => true);
}
