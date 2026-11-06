import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type LeaveNotice = {
  id: string;
  teacher_user_id: string;
  teacher_name: string;
  department_id: string | null;
  leave_from: string;
  leave_to: string;
  reason: string;
  response_text: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
};

export const BS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** केवल आजको वा भविष्यको विदा (leave_to >= today) */
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

export async function createLeave(input: {
  userId: string;
  teacherName: string;
  departmentId: string;
  from: string;
  to: string;
  reason: string;
}): Promise<void> {
  const { error } = await sb.from("teacher_leave_notices").insert({
    teacher_user_id: input.userId,
    teacher_name: input.teacherName,
    department_id: input.departmentId,
    leave_from: input.from,
    leave_to: input.to,
    reason: input.reason.trim(),
  });
  if (error) throw error;
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

export async function deleteLeave(id: string): Promise<void> {
  const { error } = await sb.from("teacher_leave_notices").delete().eq("id", id);
  if (error) throw error;
}
