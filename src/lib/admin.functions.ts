import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOGIN_DOMAIN, MIN_PASSWORD, ROLES, toEmail, validLogin } from "@/lib/login";

// Every function runs on the server and first checks that the caller is an administrator.
// The service-role key never reaches the browser.
// Results are RETURNED as { ok, error } (never thrown), so the real reason always reaches the screen.
// No input validator is declared on purpose (inputs are checked below); this avoids depending on the validator API name of the installed TanStack version.

export type AdminUser = { id: string; login: string; name: string; designation: string; dept: string; roles: string[]; disabled: boolean; lastSignIn: string | null };
export type Fail = { ok: false; error: string };
export type Done<T = unknown> = { ok: true } & T;
export type Result<T = unknown> = Done<T> | Fail;

const fail = (e: unknown): Fail => ({ ok: false, error: e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e) });

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error) throw new Error(`Could not check your role: ${error.message}`);
  if (!(data ?? []).some((r: any) => r.role === "admin")) throw new Error("Forbidden: administrators only.");
}
async function adminClient() {
  try { return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any; }
  catch (e) { throw new Error(`The server could not start its admin connection (${e instanceof Error ? e.message : e}). The SUPABASE_SERVICE_ROLE_KEY setting may be missing.`); }
}
const checkRole = (r: string) => { if (!(ROLES as readonly string[]).includes(r)) throw new Error("Invalid role."); };
const checkPw = (p: unknown) => { if (typeof p !== "string" || p.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`); };
const rolesFor = (role: string) => (role === "admin" ? ["admin", "teacher"] : [role]);

/** Gives the user exactly these roles. New roles are added FIRST, then the others are removed, so a failure can never leave a user without a role. */
async function setRolesExact(sb: any, userId: string, role: string) {
  const want = rolesFor(role);
  const ins = await sb.from("user_roles").upsert(want.map((r) => ({ user_id: userId, role: r })), { onConflict: "user_id,role", ignoreDuplicates: true });
  if (ins.error) throw new Error(`${ins.error.message}${/enum|invalid input value/i.test(ins.error.message) ? " (Did you run SQL step 01 that adds the student role?)" : ""}`);
  const del = await sb.from("user_roles").delete().eq("user_id", userId).not("role", "in", `(${want.join(",")})`);
  if (del.error) throw new Error(del.error.message);
  if (role !== "student") await sb.from("teacher_data").upsert({ teacher_id: userId }, { onConflict: "teacher_id", ignoreDuplicates: true });
}

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result<{ users: AdminUser[] }>> => {
    try {
      await assertAdmin(ctx.context);
      const sb = await adminClient();
      const { data: lu, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw new Error(error.message);
      const [p, r] = await Promise.all([sb.from("profiles").select("id,name,designation,dept"), sb.from("user_roles").select("user_id,role")]);
      if (p.error) throw new Error(p.error.message);
      const now = Date.now();
      const users: AdminUser[] = (lu.users as any[]).map((u) => {
        const pr = (p.data ?? []).find((x: any) => x.id === u.id);
        const email: string = u.email ?? "";
        return {
          id: u.id,
          login: email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email,
          name: pr?.name ?? "", designation: pr?.designation ?? "", dept: pr?.dept ?? "",
          roles: (r.data ?? []).filter((x: any) => x.user_id === u.id).map((x: any) => x.role),
          disabled: !!u.banned_until && new Date(u.banned_until).getTime() > now,
          lastSignIn: u.last_sign_in_at ?? null,
        };
      });
      return { ok: true, users };
    } catch (e) { return fail(e); }
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result<{ id: string; login: string }>> => {
    let createdId: string | null = null;
    let sb: any = null;
    try {
      await assertAdmin(ctx.context);
      const data = ctx.data ?? {};
      const login = String(data.login ?? "").trim().toLowerCase();
      const name = String(data.name ?? "").trim();
      if (!validLogin(login)) throw new Error("ID must be 3-30 letters/numbers (a-z 0-9 . _ -) or a valid e-mail.");
      if (!name) throw new Error("Name is required.");
      checkRole(data.role); checkPw(data.password);
      sb = await adminClient();
      const { data: created, error } = await sb.auth.admin.createUser({
        email: toEmail(login), password: data.password, email_confirm: true,
        user_metadata: { name }, app_metadata: { provisioned: true, role: data.role, username: login },
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) throw new Error("This ID is already in use.");
        if (/email/i.test(error.message) && /invalid|valid/i.test(error.message)) throw new Error(`${error.message}. The system rejected the internal address made from this ID. Enter a real e-mail address as the Login ID instead.`);
        throw new Error(error.message);
      }
      createdId = created.user.id as string;
      const up = await sb.from("profiles").upsert({ id: createdId, name, username: login, designation: String(data.designation ?? "").trim(), dept: String(data.dept ?? "").trim() }, { onConflict: "id" });
      if (up.error) throw new Error(`profile: ${up.error.message}`);
      await setRolesExact(sb, createdId, data.role);
      return { ok: true, id: createdId, login };
    } catch (e) {
      if (createdId && sb) { try { await sb.auth.admin.deleteUser(createdId); } catch { /* ignore */ } } // no half-made account is left behind
      return fail(e);
    }
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result> => {
    try {
      await assertAdmin(ctx.context);
      const data = ctx.data ?? {};
      checkPw(data.password);
      const { error } = await (await adminClient()).auth.admin.updateUserById(String(data.id), { password: data.password });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (e) { return fail(e); }
  });

export const adminSetDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result> => {
    try {
      await assertAdmin(ctx.context);
      const data = ctx.data ?? {};
      if (data.id === ctx.context.userId) throw new Error("You cannot disable your own account.");
      const { error } = await (await adminClient()).auth.admin.updateUserById(String(data.id), { ban_duration: data.disabled ? "876000h" : "none" });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (e) { return fail(e); }
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result> => {
    try {
      await assertAdmin(ctx.context);
      const data = ctx.data ?? {};
      checkRole(data.role);
      if (data.id === ctx.context.userId && data.role !== "admin") throw new Error("You cannot remove your own admin role.");
      await setRolesExact(await adminClient(), String(data.id), data.role);
      return { ok: true };
    } catch (e) { return fail(e); }
  });
