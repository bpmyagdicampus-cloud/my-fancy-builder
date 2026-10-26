import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/components/app/ui";
import { addAcademicYear, openTeacher, setActiveAcademicYear, useCloud } from "@/lib/cloud";
import { loadClasses, syncClasses } from "@/lib/sqc-data";
import { className, type SqcClass } from "@/lib/sqc";
import { MIN_PASSWORD } from "@/lib/login";
import { adminCreateUser, adminListUsers, adminResetPassword, adminSetDisabled, adminSetRole, type AdminUser, type Result } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Admin — Shikshak Diary" },
    { name: "description", content: "Create and manage teacher and student accounts." },
    { property: "og:title", content: "Admin — Shikshak Diary" },
    { property: "og:description", content: "Create and manage teacher and student accounts." },
  ] }),
  component: Admin,
});

const genPw = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const a = new Uint32Array(10); crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const roleOf = (r: string[]) => (r.includes("admin") ? "admin" : r.includes("teacher") ? "teacher" : r.includes("student") ? "student" : "none");
const EMPTY = { login: "", name: "", role: "teacher", designation: "", dept: "", password: "", classId: "", isRep: false };

function Admin() {
  const c = useCloud();
  const nav = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ ...EMPTY, password: genPw() });
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ text: string } | null>(null);
  const [sqcClasses, setSqcClasses] = useState<SqcClass[]>([]);
  const [yr, setYr] = useState("");

  // server functions are called without a typed payload (see admin.functions.ts), hence the casts
  const call = async <T,>(fn: (a: any) => Promise<Result<T>>, data: unknown): Promise<Result<T>> => {
    try { return await fn({ data }); } catch (e) { return { ok: false, error: `The request did not reach the server: ${msg(e)}` }; }
  };
  const load = async () => { const r = await call<{ users: AdminUser[] }>(adminListUsers as any, {}); if (r.ok) { setUsers(r.users); setErr(""); } else setErr(r.error); };
  useEffect(() => { if (c.status === "ready" && c.roles.includes("admin")) { void load(); void syncClasses().then(() => loadClasses()).then((r) => r.ok && setSqcClasses(r.data)); } }, [c.status, c.roles]);

  const create = async () => {
    setBusy(true); setErr("");
    const r = await call(adminCreateUser as any, f);
    if (r.ok) {
      setMade({ text: `शिक्षक डायरी\nLink: ${location.origin}/login\nID: ${f.login.trim().toLowerCase()}\nPassword: ${f.password}` });
      setF({ ...EMPTY, password: genPw() });
      await load();
    } else setErr(r.error);
    setBusy(false);
  };
  const run = async (fn: () => Promise<Result>) => { const r = await fn(); if (!r.ok) alert(r.error); else await load(); return r; };
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => alert("Copied"), () => alert(t));

  return (
    <Page title="Admin · खाता व्यवस्थापन" sub="Create logins, give roles, reset passwords. Passwords are never shown again after creation.">
      {err && <p className="mb-3 rounded-md border border-destructive p-2 text-sm text-destructive">{err}</p>}

      <section className="panel mb-4">
        <h2 className="mb-1 text-lg font-bold">Academic year · शैक्षिक वर्ष</h2>
        {!c.yearsReady ? (
          <p className="text-sm text-muted-foreground">Not set up yet. Run <code>docs/phase4/10_academic_years.sql</code> (after a backup) to let the administrator control the active academic year.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">Only the administrator can choose the active year. Teachers start their new year with this name.</p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {c.yearList.map((y) => (
                <button key={y.id} className={y.is_active ? "btn" : "btn-soft"} disabled={y.is_active}
                  onClick={async () => { if (!confirm(`Make ${y.name} the active academic year for everyone?`)) return; const e = await setActiveAcademicYear(y.id); if (e) alert(e); }}>
                  {y.name}{y.is_active ? " · active" : " · make active"}
                </button>
              ))}
              {!c.yearList.length && <span className="text-sm text-muted-foreground">No academic year yet. Add one below (for example 2083/84).</span>}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div><label className="lbl">New year name</label><input className="field !w-40" placeholder="2084/85" value={yr} onChange={(e) => setYr(e.target.value)} /></div>
              <button className="btn-soft" onClick={async () => { const e = await addAcademicYear(yr); if (e) alert(e); else setYr(""); }}>Add year</button>
            </div>
          </>
        )}
      </section>

      <section className="panel mb-4">
        <h2 className="mb-3 text-lg font-bold">New account</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="lbl">Login ID (a-z, 0-9) or real e-mail</label><input className="field" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} /></div>
          <div><label className="lbl">Full name</label><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="lbl">Role</label>
            <select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="teacher">Teacher · शिक्षक</option><option value="student">Student · विद्यार्थी</option><option value="admin">Admin (also a teacher)</option>
            </select></div>
          <div><label className="lbl">Designation (optional)</label><input className="field" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></div>
          <div><label className="lbl">Department (optional)</label><input className="field" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })} /></div>
          <div><label className="lbl">Password (min {MIN_PASSWORD})</label>
            <div className="flex gap-2"><input className="field" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><button className="btn-soft" onClick={() => setF({ ...f, password: genPw() })}>New</button></div></div>
        </div>
        {f.role === "student" && sqcClasses.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div><label className="lbl">SQC class (optional)</label>
              <select className="field" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}><option value="">— none —</option>{sqcClasses.map((x) => <option key={x.id} value={x.id}>{className(x)}</option>)}</select></div>
            <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" checked={f.isRep} disabled={!f.classId} onChange={(e) => setF({ ...f, isRep: e.target.checked })} />Class representative</label>
          </div>
        )}
        <button className="btn mt-3" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create account"}</button>
        {made && (
          <div className="mt-3 rounded-md border border-primary p-3 text-sm">
            <p className="mb-2 font-semibold">Account created. Send these details to the user (shown only now):</p>
            <pre className="mb-2 whitespace-pre-wrap rounded bg-muted p-2">{made.text}</pre>
            <div className="flex gap-2">
              <button className="btn-soft" onClick={() => copy(made.text)}>Copy</button>
              {typeof navigator !== "undefined" && "share" in navigator && <button className="btn-soft" onClick={() => void navigator.share({ title: "Shikshak Diary login", text: made.text })}>Share</button>}
              <button className="btn-soft" onClick={() => setMade(null)}>Hide</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel overflow-x-auto">
        <h2 className="mb-3 text-lg font-bold">Accounts ({users.length})</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-2">Name</th><th className="p-2">Login</th><th className="p-2">Role</th><th className="p-2">Last sign-in</th><th className="p-2">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-border ${u.disabled ? "opacity-50" : ""}`}>
                <td className="p-2 font-medium">{u.name || "—"}<div className="text-xs text-muted-foreground">{u.designation}</div></td>
                <td className="p-2">{u.login}{u.disabled && <span className="chip ml-1">disabled</span>}</td>
                <td className="p-2">
                  <select className="field !w-auto" value={roleOf(u.roles)} disabled={u.id === c.userId}
                    onChange={(e) => confirm(`Change role of ${u.name || u.login} to ${e.target.value}?`) && run(() => call(adminSetRole as any, { id: u.id, role: e.target.value }))}>
                    {roleOf(u.roles) === "none" && <option value="none">none</option>}
                    <option value="teacher">teacher</option><option value="student">student</option><option value="admin">admin</option>
                  </select>
                </td>
                <td className="p-2 text-xs">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleString() : "never"}</td>
                <td className="flex flex-wrap gap-1 p-2">
                  {(u.roles.includes("teacher") || u.roles.includes("admin")) && <button className="btn-soft" onClick={async () => { try { await openTeacher(u.id); nav({ to: "/" }); } catch (e) { alert(msg(e)); } }}>Open diary</button>}
                  <button className="btn-soft" onClick={() => { const pw = prompt(`New password for ${u.name || u.login} (min ${MIN_PASSWORD}):`, genPw()); if (pw) void run(async () => { const r = await call(adminResetPassword as any, { id: u.id, password: pw }); if (r.ok) prompt("Password changed. Copy it now:", pw); return r; }); }}>Reset password</button>
                  {u.id !== c.userId && <button className="btn-danger" onClick={() => confirm(`${u.disabled ? "Enable" : "Disable"} ${u.name || u.login}?`) && run(() => call(adminSetDisabled as any, { id: u.id, disabled: !u.disabled }))}>{u.disabled ? "Enable" : "Disable"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Page>
  );
}
