import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOGIN_DOMAIN, MIN_PASSWORD, ROLES, toEmail, validLogin } from "@/lib/login";

// Every function runs on the server and first checks the caller's role/permissions.
// The service-role key never reaches the browser.
// Results are RETURNED as { ok, error } (never thrown), so the real reason always reaches the screen.
// No input validator is declared on purpose (inputs are checked below); this avoids depending on the validator API name of the installed TanStack version.

export type AdminUser = { id: string; login: string; name: string; designation: string; dept: string; campus?: string; address?: string; hod?: string; chief?: string; roles: string[]; disabled: boolean; lastSignIn: string | null };
export type SetupTeacher = { id: string; name: string; designation: string; dept: string; campus: string; address: string; hod: string; chief: string; canEdit: boolean };
export type PeerStudentSource = {
  key: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  centralId?: string;
  className: string;
  subject: string;
  code: string;
  students: { name: string; roll: number }[];
  isOtherTeacher?: boolean;
  sameClass?: boolean;
};
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
      const [p, r] = await Promise.all([sb.from("profiles").select("id,name,designation,dept,campus,address,hod,chief"), sb.from("user_roles").select("user_id,role")]);
      if (p.error) throw new Error(p.error.message);
      const now = Date.now();
      const users: AdminUser[] = (lu.users as any[]).map((u) => {
        const pr = (p.data ?? []).find((x: any) => x.id === u.id);
        const email: string = u.email ?? "";
        return {
          id: u.id,
          login: email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -(LOGIN_DOMAIN.length + 1)) : email,
          name: pr?.name ?? "", designation: pr?.designation ?? "", dept: pr?.dept ?? "",
          campus: pr?.campus ?? "", address: pr?.address ?? "", hod: pr?.hod ?? "", chief: pr?.chief ?? "",
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
      if (data.role === "student" && data.classId) {
        // optional: put the student straight into an SQC class (needs docs/phase4/20_sqc.sql)
        const m = await sb.from("sqc_members").upsert({ user_id: createdId, class_id: String(data.classId), is_rep: !!data.isRep }, { onConflict: "user_id,class_id" });
        if (m.error) throw new Error(`class assignment: ${m.error.message}`);
      }
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

/** Administrator edits another person's details (everything except the login ID). */
export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result> => {
    try {
      await assertAdmin(ctx.context);
      const data = ctx.data ?? {};
      const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
      const name = clean(data.name, 120);
      if (!name) throw new Error("Name is required.");
      const patch = { name, designation: clean(data.designation, 120), dept: clean(data.dept, 120), campus: clean(data.campus, 200), address: clean(data.address, 200), hod: clean(data.hod, 120), chief: clean(data.chief, 120) };
      const { error } = await (await adminClient()).from("profiles").update(patch).eq("id", String(data.id));
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

/**
 * Lists teacher profiles for Setup -> Teacher details based on the caller's role:
 * - Admin: sees all teachers
 * - Department Head: sees teachers of own department(s) (and self)
 * - Teacher: sees own profile only
 */
export const setupListTeachers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result<{ teachers: SetupTeacher[]; scope: "admin" | "head" | "teacher"; headDepts: string[] }>> => {
    try {
      const uid = String(ctx.context.userId);
      const sb = await adminClient();
      const [rolesRes, profRes, headsRes, deptsRes, tdRes] = await Promise.all([
        sb.from("user_roles").select("user_id,role"),
        sb.from("profiles").select("id,name,designation,dept,campus,address,hod,chief").order("name"),
        sb.from("department_heads").select("user_id,department_id"),
        sb.from("departments").select("id,name"),
        sb.from("teacher_data").select("teacher_id,content"),
      ]);
      if (profRes.error) throw new Error(profRes.error.message);
      const allRoles = (rolesRes.data ?? []) as { user_id: string; role: string }[];
      const myRoles = allRoles.filter((r) => r.user_id === uid).map((r) => r.role);
      const isAdmin = myRoles.includes("admin");
      const staffIds = new Set(allRoles.filter((r) => r.role === "teacher" || r.role === "admin").map((r) => r.user_id));

      const heads = (headsRes.data ?? []) as { user_id: string; department_id: string }[];
      const depts = (deptsRes.data ?? []) as { id: string; name: string }[];
      const myHeadDeptIds = new Set(heads.filter((h) => h.user_id === uid).map((h) => h.department_id));
      const myHeadDeptNames = depts
        .filter((d) => myHeadDeptIds.has(d.id))
        .map((d) => d.name.trim());
      const myHeadDeptNamesLower = new Set(myHeadDeptNames.map((n) => n.toLowerCase()));

      // Also check which teachers teach a class in the head's department(s)
      const teachesInMyDept = new Set<string>();
      if (myHeadDeptIds.size > 0 && Array.isArray(tdRes.data)) {
        for (const row of tdRes.data as any[]) {
          const classes = Array.isArray(row?.content?.classes) ? row.content.classes : [];
          if (classes.some((c: any) => c?.deptId && myHeadDeptIds.has(String(c.deptId)))) {
            teachesInMyDept.add(String(row.teacher_id));
          }
        }
        for (const h of heads) {
          if (myHeadDeptIds.has(h.department_id)) teachesInMyDept.add(h.user_id);
        }
      }

      const scope: "admin" | "head" | "teacher" = isAdmin ? "admin" : myHeadDeptIds.size > 0 ? "head" : "teacher";
      const profiles = (profRes.data ?? []) as any[];
      const filtered = profiles.filter((p) => {
        if (!staffIds.has(p.id) && p.id !== uid) return false;
        if (isAdmin) return true;
        if (p.id === uid) return true;
        if (scope === "head") {
          const dName = String(p.dept ?? "").trim().toLowerCase();
          return (dName && myHeadDeptNamesLower.has(dName)) || teachesInMyDept.has(p.id);
        }
        return false;
      });

      const teachers: SetupTeacher[] = filtered.map((p) => ({
        id: p.id,
        name: p.name ?? "",
        designation: p.designation ?? "",
        dept: p.dept ?? "",
        campus: p.campus ?? "",
        address: p.address ?? "",
        hod: p.hod ?? "",
        chief: p.chief ?? "",
        canEdit: true,
      }));
      return { ok: true, teachers, scope, headDepts: myHeadDeptNames };
    } catch (e) {
      return fail(e);
    }
  });

/**
 * Updates a teacher's profile details from Setup -> Teacher details according to role:
 * - Admin: can edit any teacher
 * - Department Head: can edit teachers of own department (and self)
 * - Teacher: can edit own profile only
 */
export const setupUpdateTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result> => {
    try {
      const uid = String(ctx.context.userId);
      const data = ctx.data ?? {};
      const targetId = String(data.id ?? "").trim();
      if (!targetId) throw new Error("Teacher ID is required.");

      const sb = await adminClient();
      const [rolesRes, headsRes, deptsRes, targetProfRes, tdRes] = await Promise.all([
        sb.from("user_roles").select("role").eq("user_id", uid),
        sb.from("department_heads").select("user_id,department_id"),
        sb.from("departments").select("id,name"),
        sb.from("profiles").select("id,dept").eq("id", targetId).maybeSingle(),
        sb.from("teacher_data").select("content").eq("teacher_id", targetId).maybeSingle(),
      ]);

      const isAdmin = (rolesRes.data ?? []).some((r: any) => r.role === "admin");
      let allowed = isAdmin || targetId === uid;

      if (!allowed) {
        const heads = (headsRes.data ?? []) as { user_id: string; department_id: string }[];
        const depts = (deptsRes.data ?? []) as { id: string; name: string }[];
        const myHeadDeptIds = new Set(heads.filter((h) => h.user_id === uid).map((h) => h.department_id));
        const myHeadDeptNamesLower = new Set(
          depts.filter((d) => myHeadDeptIds.has(d.id)).map((d) => d.name.trim().toLowerCase())
        );
        const targetDept = String(targetProfRes.data?.dept ?? "").trim().toLowerCase();
        const targetClasses = Array.isArray(tdRes.data?.content?.classes) ? tdRes.data.content.classes : [];
        const teachesInDept = targetClasses.some((c: any) => c?.deptId && myHeadDeptIds.has(String(c.deptId)));
        const isHeadOfSame = heads.some((h) => h.user_id === targetId && myHeadDeptIds.has(h.department_id));
        if ((targetDept && myHeadDeptNamesLower.has(targetDept)) || teachesInDept || isHeadOfSame) {
          allowed = true;
        }
      }

      if (!allowed) throw new Error("तपाइँलाई यो शिक्षकको विवरण सम्पादन गर्ने अनुमति छैन। / You are not allowed to edit this teacher's details.");

      const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
      const name = clean(data.name, 120);
      if (!name) throw new Error("Name is required.");
      const patch = {
        name,
        designation: clean(data.designation, 120),
        dept: clean(data.dept, 120),
        campus: clean(data.campus, 200),
        address: clean(data.address, 200),
        hod: clean(data.hod, 120),
        chief: clean(data.chief, 120),
      };
      const { error } = await sb.from("profiles").update(patch).eq("id", targetId);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (e) {
      return fail(e);
    }
  });

/**
 * Returns all classes across ALL teachers in the cloud that have students,
 * so any teacher can view and pull students from another teacher's subject of the same class.
 */
export const listPeerClassStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx: any): Promise<Result<{ sources: PeerStudentSource[] }>> => {
    try {
      const data = ctx.data ?? {};
      const excludeClassId = String(data.excludeClassId ?? "").trim();

      const sb = await adminClient();
      const [tdRes, profRes] = await Promise.all([
        sb.from("teacher_data").select("teacher_id,content"),
        sb.from("profiles").select("id,name"),
      ]);
      if (tdRes.error) throw new Error(tdRes.error.message);
      const nameMap = new Map<string, string>();
      for (const p of (profRes.data ?? []) as any[]) {
        if (p?.id) nameMap.set(String(p.id), String(p.name ?? "").trim() || "Teacher");
      }

      const sources: PeerStudentSource[] = [];
      const extractFromSet = (tId: string, tName: string, setObj: any) => {
        const classes = Array.isArray(setObj?.classes) ? setObj.classes : [];
        const allStudents = Array.isArray(setObj?.students) ? setObj.students : [];
        for (const c of classes) {
          if (!c || c.closed) continue;
          if (excludeClassId && String(c.id) === excludeClassId) continue;

          let stu: { name: string; roll: number }[] = allStudents
            .filter((s: any) => s && s.classId === c.id && s.active !== false && String(s.name ?? "").trim())
            .map((s: any, idx: number) => ({ name: String(s.name).trim(), roll: Number(s.roll) || idx + 1 }))
            .sort((a: { roll: number; name: string }, b: { roll: number; name: string }) => a.roll - b.roll || a.name.localeCompare(b.name));

          if (stu.length === 0 && typeof c.students === "string" && c.students.trim()) {
            stu = c.students
              .split("\n")
              .map((s: string) => s.trim())
              .filter(Boolean)
              .map((name: string, idx: number) => ({ name, roll: idx + 1 }));
          }
          if (stu.length === 0) continue;

          sources.push({
            key: `${tId}:${c.id}`,
            teacherId: tId,
            teacherName: tName,
            classId: String(c.id),
            centralId: String(c.centralId ?? ""),
            className: String(c.name ?? ""),
            subject: String(c.subject ?? "Subject"),
            code: String(c.code ?? ""),
            students: stu,
          });
        }
      };

      for (const row of (tdRes.data ?? []) as any[]) {
        const tId = String(row.teacher_id);
        const tName = nameMap.get(tId) || "Teacher";
        const content = row.content ?? {};
        extractFromSet(tId, tName, content);
        if (content.archive && typeof content.archive === "object") {
          for (const archSet of Object.values(content.archive)) {
            extractFromSet(tId, tName, archSet);
          }
        }
      }
      return { ok: true, sources };
    } catch (e) {
      return fail(e);
    }
  });
