import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/components/app/ui";
import { addAcademicYear, deleteAcademicYear, openTeacher, setActiveAcademicYear, useCloud } from "@/lib/cloud";
import { loadClasses, syncClasses } from "@/lib/sqc-data";
import { className, type SqcClass } from "@/lib/sqc";
import { MIN_PASSWORD } from "@/lib/login";
import {
  adminCreateUser,
  adminListUsers,
  adminResetPassword,
  adminSetDisabled,
  adminSetRole,
  adminUpdateProfile,
  type AdminUser,
  type Result,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Shikshak Diary" },
      { name: "description", content: "Create and manage teacher and student accounts, and control academic years." },
      { property: "og:title", content: "Admin — Shikshak Diary" },
      { property: "og:description", content: "Create and manage teacher and student accounts." },
    ],
  }),
  component: Admin,
});

const genPw = () => {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const a = new Uint32Array(10);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const roleOf = (r: string[]) =>
  r.includes("admin") ? "admin" : r.includes("teacher") ? "teacher" : r.includes("student") ? "student" : "none";
const EMPTY = { login: "", name: "", role: "teacher", designation: "", dept: "", password: "", classId: "", isRep: false };

function Admin() {
  const c = useCloud();
  const nav = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ ...EMPTY, password: genPw() });
  const [showNewForm, setShowNewForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ text: string } | null>(null);
  const [sqcClasses, setSqcClasses] = useState<SqcClass[]>([]);
  const [yr, setYr] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "teacher" | "student">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [ed, setEd] = useState<{
    id: string;
    login: string;
    name: string;
    designation: string;
    dept: string;
    campus: string;
    address: string;
    hod: string;
    chief: string;
  } | null>(null);

  const call = async <T,>(fn: (a: any) => Promise<Result<T>>, data: unknown): Promise<Result<T>> => {
    try {
      return await fn({ data });
    } catch (e) {
      return { ok: false, error: `The request did not reach the server: ${msg(e)}` };
    }
  };
  const load = async () => {
    const r = await call<{ users: AdminUser[] }>(adminListUsers as any, {});
    if (r.ok) {
      setUsers(r.users);
      setErr("");
    } else setErr(r.error);
  };
  useEffect(() => {
    if (c.status === "ready" && c.roles.includes("admin")) {
      void load();
      void syncClasses()
        .then(() => loadClasses())
        .then((r) => r.ok && setSqcClasses(r.data));
    }
  }, [c.status, c.roles]);

  const create = async () => {
    setBusy(true);
    setErr("");
    const r = await call(adminCreateUser as any, f);
    if (r.ok) {
      setMade({
        text: `शिक्षक डायरी\nLink: ${location.origin}/login\nID: ${f.login.trim().toLowerCase()}\nPassword: ${f.password}`,
      });
      setF({ ...EMPTY, password: genPw() });
      await load();
    } else setErr(r.error);
    setBusy(false);
  };
  const run = async (fn: () => Promise<Result>) => {
    const r = await fn();
    if (!r.ok) alert(r.error);
    else await load();
    return r;
  };
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => alert("Copied"), () => alert(t));

  const filteredUsers = users.filter((u) => {
    const r = roleOf(u.roles);
    if (roleFilter !== "all" && r !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.login || "").toLowerCase().includes(q) ||
      (u.dept || "").toLowerCase().includes(q) ||
      (u.designation || "").toLowerCase().includes(q)
    );
  });

  return (
    <Page
      title="Admin · प्रशासन तथा खाता व्यवस्थापन"
      sub="शैक्षिक वर्ष नियन्त्रण, नयाँ शिक्षक/विद्यार्थी खाता निर्माण र पासवर्ड व्यवस्थापन"
      actions={
        <button className="btn" onClick={() => setShowNewForm((v) => !v)}>
          {showNewForm ? "✕ फारम बन्द गर्नुहोस्" : "+ New account · नयाँ खाता थप्नुहोस्"}
        </button>
      }
    >
      {err && <p className="mb-4 rounded-xl border border-destructive bg-destructive/5 p-3 text-sm text-destructive">{err}</p>}

      {/* Academic Year Management Card */}
      <section className="panel mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">📅 Academic year · शैक्षिक वर्ष व्यवस्थापन</h2>
            <p className="text-xs text-muted-foreground">
              यहाँबाट सक्रिय (Active) शैक्षिक वर्ष तोक्न वा गल्तीले बनेको शैक्षिक वर्ष हटाउन सकिन्छ।
            </p>
          </div>
        </div>
        {!c.yearsReady ? (
          <p className="text-sm text-muted-foreground">
            Not set up yet. Run <code>docs/phase4/10_academic_years.sql</code> to let the administrator control the active academic year.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {c.yearList.map((y) => (
                <div
                  key={y.id}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    y.is_active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-muted/50 text-foreground"
                  }`}
                >
                  <span>
                    {y.name} {y.is_active ? "· Active ✓" : ""}
                  </span>
                  {!y.is_active && (
                    <>
                      <button
                        type="button"
                        className="rounded bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={async () => {
                          if (!confirm(`Make ${y.name} the active academic year for everyone?`)) return;
                          const e = await setActiveAcademicYear(y.id);
                          if (e) alert(e);
                        }}
                      >
                        Make active
                      </button>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/15"
                        title={`गल्तीले बनेको "${y.name}" हटाउनुहोस्`}
                        onClick={async () => {
                          if (!confirm(`के तपाइँ गल्तीले बनेको शैक्षिक वर्ष "${y.name}" लाई हटाउन चाहनुहुन्छ?`))
                            return;
                          const e = await deleteAcademicYear(y.id);
                          if (e) alert(e);
                        }}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              ))}
              {!c.yearList.length && (
                <span className="text-sm text-muted-foreground">
                  No academic year yet. Add one below (for example 2083/84).
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-border/70 pt-3">
              <div>
                <label className="lbl">New year name · नयाँ वर्षको नाम</label>
                <input
                  className="field !w-40"
                  placeholder="2084/85"
                  value={yr}
                  onChange={(e) => setYr(e.target.value)}
                />
              </div>
              <button
                className="btn-soft"
                onClick={async () => {
                  const e = await addAcademicYear(yr);
                  if (e) alert(e);
                  else setYr("");
                }}
              >
                + Add year
              </button>
            </div>
          </>
        )}
      </section>

      {/* Collapsible New Account Drawer */}
      {(showNewForm || made) && (
        <section className="panel mb-4 border-primary/40 bg-secondary/30">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">➕ New account · नयाँ प्रयोगकर्ता खाता</h2>
            <button type="button" className="btn-soft !min-h-8 !px-2.5 !py-1 text-xs" onClick={() => setShowNewForm(false)}>
              ✕ बन्द गर्नुहोस्
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="lbl">Login ID (a-z, 0-9) or e-mail</label>
              <input className="field" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Full name · पूरा नाम</label>
              <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Role · भूमिका</label>
              <select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <option value="teacher">Teacher · शिक्षक</option>
                <option value="student">Student · विद्यार्थी</option>
                <option value="admin">Admin (प्रशासक तथा शिक्षक)</option>
              </select>
            </div>
            <div>
              <label className="lbl">Designation · पद (optional)</label>
              <input
                className="field"
                value={f.designation}
                onChange={(e) => setF({ ...f, designation: e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Department · विभाग (optional)</label>
              <input className="field" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Password (min {MIN_PASSWORD})</label>
              <div className="flex gap-2">
                <input
                  className="field"
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                />
                <button className="btn-soft" onClick={() => setF({ ...f, password: genPw() })}>
                  New
                </button>
              </div>
            </div>
          </div>
          {f.role === "student" && sqcClasses.length > 0 && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="lbl">SQC class (optional)</label>
                <select
                  className="field"
                  value={f.classId}
                  onChange={(e) => setF({ ...f, classId: e.target.value })}
                >
                  <option value="">— none —</option>
                  {sqcClasses.map((x) => (
                    <option key={x.id} value={x.id}>
                      {className(x)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-1 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.isRep}
                  disabled={!f.classId}
                  onChange={(e) => setF({ ...f, isRep: e.target.checked })}
                />
                Class representative
              </label>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button className="btn" disabled={busy} onClick={create}>
              {busy ? "Creating…" : "Create account · खाता बनाउनुहोस्"}
            </button>
            <button className="btn-soft" onClick={() => setShowNewForm(false)}>
              Cancel
            </button>
          </div>
          {made && (
            <div className="mt-3 rounded-xl border border-primary bg-card p-3 text-sm">
              <p className="mb-2 font-semibold text-primary">
                ✓ Account created. Send these login details to the user:
              </p>
              <pre className="mb-2 whitespace-pre-wrap rounded-lg bg-muted p-2.5 text-xs">{made.text}</pre>
              <div className="flex gap-2">
                <button className="btn-soft" onClick={() => copy(made.text)}>
                  📋 Copy
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    className="btn-soft"
                    onClick={() => void navigator.share({ title: "Shikshak Diary login", text: made.text })}
                  >
                    Share
                  </button>
                )}
                <button className="btn-soft" onClick={() => setMade(null)}>
                  Hide
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {ed && (
        <section className="panel mb-4 border-primary/40 bg-secondary/30">
          <h2 className="mb-1 text-lg font-bold">✏️ Edit account details · विवरण सम्पादन</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Login ID: <b>{ed.login}</b>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["name", "Name · नाम"],
                ["designation", "Designation · पद"],
                ["dept", "Department · विभाग"],
                ["campus", "Campus · क्याम्पस"],
                ["address", "Address · ठेगाना"],
                ["hod", "Head of department"],
                ["chief", "Campus chief"],
              ] as const
            ).map(([k, l]) => (
              <div key={k}>
                <label className="lbl">{l}</label>
                <input className="field" value={ed[k]} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="btn"
              onClick={() =>
                void run(async () => {
                  const r = await call(adminUpdateProfile as any, ed);
                  if (r.ok) setEd(null);
                  return r;
                })
              }
            >
              Save details
            </button>
            <button className="btn-soft" onClick={() => setEd(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Accounts Table with Search, Filter, and Clean Three-Dot Menu */}
      <section className="panel">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            👥 Accounts · प्रयोगकर्ता खाताहरू ({filteredUsers.length} / {users.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="🔍 नाम, ID वा विभाग खोज्नुहोस्..."
              className="field !h-9 !w-56 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              {(
                [
                  ["all", "All"],
                  ["admin", "Admin"],
                  ["teacher", "Teacher"],
                  ["student", "Student"],
                ] as const
              ).map(([rk, rl]) => (
                <button
                  key={rk}
                  type="button"
                  onClick={() => setRoleFilter(rk)}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    roleFilter === rk
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {rl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-2.5">Name & Department</th>
                <th className="p-2.5">Login ID</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5">Last sign-in</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isMenuOpen = openMenuId === u.id;
                return (
                  <tr key={u.id} className={`border-b border-border/70 hover:bg-muted/30 ${u.disabled ? "opacity-50" : ""}`}>
                    <td className="p-2.5 font-semibold">
                      {u.name || "—"}
                      <div className="text-xs font-normal text-muted-foreground">
                        {[u.designation, u.dept].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="p-2.5 text-xs font-mono">
                      {u.login}
                      {u.disabled && <span className="chip ml-1.5 !text-destructive">disabled</span>}
                    </td>
                    <td className="p-2.5">
                      <select
                        className="field !h-8 !w-auto !py-0 text-xs font-semibold"
                        value={roleOf(u.roles)}
                        disabled={u.id === c.userId}
                        onChange={(e) =>
                          confirm(`Change role of ${u.name || u.login} to ${e.target.value}?`) &&
                          run(() => call(adminSetRole as any, { id: u.id, role: e.target.value }))
                        }
                      >
                        {roleOf(u.roles) === "none" && <option value="none">none</option>}
                        <option value="teacher">teacher</option>
                        <option value="student">student</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="p-2.5 text-xs text-muted-foreground">
                      {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : "never"}
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="relative inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-soft !min-h-8 !px-2.5 !py-1 text-xs"
                          onClick={() => {
                            setEd({
                              id: u.id,
                              login: u.login,
                              name: u.name,
                              designation: u.designation,
                              dept: u.dept,
                              campus: u.campus ?? "",
                              address: u.address ?? "",
                              hod: u.hod ?? "",
                              chief: u.chief ?? "",
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-soft !min-h-8 !w-8 !p-0 text-base font-bold"
                          title="थप कार्यहरू · More actions"
                          onClick={() => setOpenMenuId(isMenuOpen ? null : u.id)}
                        >
                          ⋮
                        </button>
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-border bg-card p-1.5 text-left text-xs shadow-xl"
                            onMouseLeave={() => setOpenMenuId(null)}
                          >
                            {(u.roles.includes("teacher") || u.roles.includes("admin")) && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-medium hover:bg-muted"
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  try {
                                    await openTeacher(u.id);
                                    nav({ to: "/" });
                                  } catch (e) {
                                    alert(msg(e));
                                  }
                                }}
                              >
                                📖 Open diary · डायरी खोल्नुहोस्
                              </button>
                            )}
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-medium hover:bg-muted"
                              onClick={() => {
                                setOpenMenuId(null);
                                const pw = prompt(
                                  `New password for ${u.name || u.login} (min ${MIN_PASSWORD}):`,
                                  genPw()
                                );
                                if (pw)
                                  void run(async () => {
                                    const r = await call(adminResetPassword as any, { id: u.id, password: pw });
                                    if (r.ok) prompt("Password changed. Copy it now:", pw);
                                    return r;
                                  });
                              }}
                            >
                              🔑 Reset password
                            </button>
                            {u.id !== c.userId && (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-semibold text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  if (confirm(`${u.disabled ? "Enable" : "Disable"} ${u.name || u.login}?`)) {
                                    void run(() =>
                                      call(adminSetDisabled as any, { id: u.id, disabled: !u.disabled })
                                    );
                                  }
                                }}
                              >
                                🚫 {u.disabled ? "Enable account" : "Disable account"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredUsers.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                    कुनै प्रयोगकर्ता भेटिएन (No matching accounts found).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}
