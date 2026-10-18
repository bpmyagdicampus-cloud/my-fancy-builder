import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOGIN_DOMAIN, MIN_PASSWORD, ROLES, toEmail, validLogin } from "@/lib/login";

// Every function here runs on the server and first checks that the caller really is an admin.
// The service-role key never reaches the browser.

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error || !(data ?? []).some((r: any) => r.role === "admin")) throw new Error("Forbidden: administrators only.");
}
const admin = async () => ((await import("@/integrations/supabase/client.server")).supabaseAdmin as any);
const checkRole = (r: string) => { if (!(ROLES as readonly string[]).includes(r)) throw new Error("Invalid role."); };
const checkPw = (p: string) => { if (typeof p !== "string" || p.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`); };

export type AdminUser = { id: string; login: string; name: string; designation: string; dept: string; roles: string[]; disabled: boolean; lastSignIn: string | null };

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, never>) => d)
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context);
    const sb = await admin();
    const { data: lu, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const [{ data: profs }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("id,name,designation,dept"),
      sb.from("user_roles").select("user_id,role"),
    ]);
    const now = Date.now();
    return (lu.users as any[]).map((u) => {
      const p = (profs ?? []).find((x: any) => x.id === u.id);
      const email: string = u.email ?? "";
      return {
        id: u.id,
        login: email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email,
        name: p?.name ?? "", designation: p?.designation ?? "", dept: p?.dept ?? "",
        roles: (roles ?? []).filter((r: any) => r.user_id === u.id).map((r: any) => r.role),
        disabled: !!u.banned_until && new Date(u.banned_until).getTime() > now,
        lastSignIn: u.last_sign_in_at ?? null,
      };
    });
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { login: string; password: string; name: string; role: string; designation?: string; dept?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const login = String(data.login ?? "").trim().toLowerCase();
    const name = String(data.name ?? "").trim();
    if (!validLogin(login)) throw new Error("ID must be 3-30 letters/numbers (a-z 0-9 . _ -) or a valid e-mail.");
    if (!name) throw new Error("Name is required.");
    checkRole(data.role); checkPw(data.password);
    const sb = await admin();
    const { data: created, error } = await sb.auth.admin.createUser({
      email: toEmail(login), password: data.password, email_confirm: true,
      user_metadata: { name }, app_metadata: { provisioned: true, role: data.role, username: login },
    });
    if (error) throw new Error(/already|registered|exists/i.test(error.message) ? "This ID is already in use." : error.message);
    const id: string = created.user.id;
    try {
      let r = await sb.from("profiles").upsert({ id, name, username: login, designation: data.designation?.trim() ?? "", dept: data.dept?.trim() ?? "" }, { onConflict: "id" });
      if (r.error) throw new Error(r.error.message);
      await sb.from("user_roles").delete().eq("user_id", id);
      r = await sb.from("user_roles").insert((data.role === "admin" ? ["admin", "teacher"] : [data.role]).map((role) => ({ user_id: id, role })));
      if (r.error) throw new Error(r.error.message + " (Did you run SQL step 01 that adds the student role?)");
      if (data.role !== "student") await sb.from("teacher_data").upsert({ teacher_id: id }, { onConflict: "teacher_id", ignoreDuplicates: true });
    } catch (e) {
      await sb.auth.admin.deleteUser(id); // roll back, so no half-made account is left behind
      throw e;
    }
    return { id, login };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    checkPw(data.password);
    const { error } = await (await admin()).auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; disabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("You cannot disable your own account.");
    const { error } = await (await admin()).auth.admin.updateUserById(data.id, { ban_duration: data.disabled ? "876000h" : "none" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; role: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    checkRole(data.role);
    if (data.id === context.userId && data.role !== "admin") throw new Error("You cannot remove your own admin role.");
    const sb = await admin();
    await sb.from("user_roles").delete().eq("user_id", data.id);
    const r = await sb.from("user_roles").insert((data.role === "admin" ? ["admin", "teacher"] : [data.role]).map((role) => ({ user_id: data.id, role })));
    if (r.error) throw new Error(r.error.message);
    if (data.role !== "student") await sb.from("teacher_data").upsert({ teacher_id: data.id }, { onConflict: "teacher_id", ignoreDuplicates: true });
    return { ok: true };
  });
