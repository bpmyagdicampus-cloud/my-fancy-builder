import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type LeaveNotice = {
  id: string;
  teacher_user_id: string;
  teacher_name: string;
  department_id: string | null;
  local_leave_id: string | null;
  leave_from: string;
  leave_to: string;
  reason: string;
  response_text: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
};

export const BS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Home को लागि: केवल आजको वा भविष्यको विदा */
export async function loadUpcomingLeaves(today: string): Promise<LeaveNotice[]> {
  const { data, error } = await sb
    .from("teacher_leave_notices")
    .select("*")
    .gte("leave_to", today)
    .order("leave_from", { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as LeaveNotice[]).filter((n) => n.leave_to >= today);
}

export async function respondLeave(id: string, userId: string, text: string): Promise<void> {
  const { error } = await sb
    .from("teacher_leave_notices")
    .update({
      response_text: text.trim(),
      responded_by: userId,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export type LocalLeave = { id: string; kind: string; from: string; to: string; reason: string };

/**
 * Records → Leave मा भएका आजको वा भविष्यका विदालाई shared table मा sync गर्छ।
 * - नयाँ विदा भए थप्छ
 * - सच्याइएको विदा भए अपडेट गर्छ (जवाफ सुरक्षित रहन्छ)
 * - मेटाइएको वा विगत भएको विदा हटाउँछ
 */
export async function syncOwnLeaves(params: {
  userId: string;
  teacherName: string;
  departmentId: string | null;
  leaves: LocalLeave[];
  today: string;
}): Promise<void> {
  const { userId, teacherName, departmentId, leaves, today } = params;

  const rows = leaves
    .map((l) => {
      const to = l.to || l.from;
      return {
        teacher_user_id: userId,
        teacher_name: teacherName,
        department_id: departmentId,
        local_leave_id: l.id,
        leave_from: l.from,
        leave_to: to,
        reason: [l.kind, l.reason].filter(Boolean).join(" · "),
      };
    })
    .filter((r) => BS_DATE_RE.test(r.leave_from) && BS_DATE_RE.test(r.leave_to) && r.leave_to >= today);

  if (rows.length) {
    const { error } = await sb
      .from("teacher_leave_notices")
      .upsert(rows, { onConflict: "teacher_user_id,local_leave_id" });
    if (error) throw error;
  }

  const keep = new Set(rows.map((r) => r.local_leave_id));
  const { data: existing, error: selErr } = await sb
    .from("teacher_leave_notices")
    .select("id,local_leave_id")
    .eq("teacher_user_id", userId);
  if (selErr) throw selErr;
  const stale = ((existing ?? []) as { id: string; local_leave_id: string | null }[])
    .filter((r) => !r.local_leave_id || !keep.has(r.local_leave_id))
    .map((r) => r.id);
  if (stale.length) {
    const { error } = await sb.from("teacher_leave_notices").delete().in("id", stale);
    if (error) throw error;
  }
}
