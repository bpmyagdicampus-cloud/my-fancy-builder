import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Page, Tabs } from "@/components/app/ui";
import { useCloud } from "@/lib/cloud";
import { adminListUsers, type AdminUser, type Result } from "@/lib/admin.functions";
import * as C from "@/lib/campus";
import type { R } from "@/lib/sqc-data";

export const Route = createFileRoute("/campus")({
  head: () => ({ meta: [
    { title: "Campus — Shikshak Diary" },
    { name: "description", content: "Institutional profile, departments, programs, classes and students." },
    { property: "og:title", content: "Campus — Shikshak Diary" },
    { property: "og:description", content: "Institutional profile, departments, programs, classes and students." },
  ] }),
  component: Campus,
});

type T = "profile" | "departments" | "structure" | "students";
const EMPTY: C.CampusData = { profile: C.EMPTY_PROFILE, departments: [], heads: [], programs: [], classes: [], students: [] };

/** Small "⋮" menu (no extra package). */
function Dots({ items }: { items: [string, () => void, boolean?][] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative inline-block">
      <summary className="btn-soft cursor-pointer list-none !px-2" aria-label="Options">⋮</summary>
      <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-border bg-card p-1 shadow-lg">
        {items.map(([label, fn, danger]) => (
          <button key={label} className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted ${danger ? "text-destructive" : ""}`}
            onClick={() => { if (ref.current) ref.current.open = false; fn(); }}>{label}</button>
        ))}
      </div>
    </details>
  );
}

function Campus() {
  const cl = useCloud();
  const admin = cl.roles.includes("admin");
  const [d, setD] = useState<C.CampusData>(EMPTY);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<T>("structure");
  const [users, setUsers] = useState<AdminUser[]>([]);

  const load = useCallback(async () => {
    const r = await C.loadCampus();
    if (r.ok) { setD(r.data); setState("ok"); setErr(""); } else { setState("error"); setErr(r.error); }
  }, []);
  useEffect(() => { if (cl.status === "ready" && cl.userId) void load(); }, [cl.status, cl.userId, load]);
  useEffect(() => {
    if (!admin) return;
    (async () => {
      try { const u = (await (adminListUsers as any)({ data: {} })) as Result<{ users: AdminUser[] }>; if (u.ok) setUsers(u.users.filter((x) => x.roles.includes("teacher") || x.roles.includes("admin"))); } catch { /* ignore */ }
    })();
  }, [admin]);

  const myDepts = d.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);
  const manage = (deptId: string) => admin || myDepts.includes(deptId);
  const depts = d.departments.filter((x) => manage(x.id));
  const isHead = myDepts.length > 0;
  const canManage = admin || isHead;

  /** Runs a database action, shows the result and reloads. */
  const act = async <X,>(p: Promise<R<X>>, ok = "Saved.") => {
    const r = await p;
    setNote(r.ok ? ok : r.error);
    if (r.ok) await load();
    return r.ok;
  };

  if (cl.status !== "ready" || !cl.userId) return <Page title="Campus · क्याम्पस"><p className="text-sm text-muted-foreground">Please sign in.</p></Page>;
  if (state === "loading") return <Page title="Campus · क्याम्पस"><p className="text-sm text-muted-foreground">Loading…</p></Page>;
  if (state === "error") return <Page title="Campus · क्याम्पस"><p className="rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p><button className="btn-soft mt-3" onClick={() => { setState("loading"); void load(); }}>Try again</button></Page>;

  const tabs: [T, string][] = [["structure", "Programs & classes"], ["students", "Students"], ["profile", "Institutional profile"]];
  if (admin) tabs.splice(0, 0, ["departments", "Departments"]);

  return (
    <Page title="Campus · क्याम्पस" sub={admin ? "Administrator: manages everything" : isHead ? `Department head: ${depts.map((x) => x.name).join(", ")}` : "You can view the campus structure. Classes and students are managed by the administrator and department heads."}>
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      <Tabs value={tab} onChange={(v) => { setTab(v); setNote(""); }} items={tabs} />
      {tab === "profile" && <ProfileTab d={d} admin={admin} act={act} />}
      {tab === "departments" && admin && <DepartmentsTab d={d} users={users} act={act} />}
      {tab === "structure" && <StructureTab d={d} depts={canManage ? depts : []} act={act} canManage={canManage} />}
      {tab === "students" && (canManage ? <StudentsTab d={d} depts={depts} act={act} setNote={setNote} /> : <p className="text-sm text-muted-foreground">Only the administrator and department heads manage students.</p>)}
    </Page>
  );
}
type Act = <X>(p: Promise<R<X>>, ok?: string) => Promise<boolean>;

function ProfileTab({ d, admin, act }: { d: C.CampusData; admin: boolean; act: Act }) {
  const [f, setF] = useState<C.CampusProfile>(d.profile);
  const F = (k: keyof C.CampusProfile, l: string, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}><label className="lbl">{l}</label><input className="field" disabled={!admin} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <section className="panel">
      <h2 className="mb-3 text-lg font-bold">Institutional profile · संस्थागत विवरण</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {F("name", "Campus name · क्याम्पसको नाम", true)}
        {F("address", "Address · ठेगाना", true)}
        {F("website", "Website")}
        {F("email", "Email")}
        {F("phone", "Phone · फोन नं.")}
      </div>
      {admin ? <button className="btn mt-3" onClick={() => void act(C.saveProfile(f))}>Save</button> : <p className="mt-3 text-xs text-muted-foreground">Only the administrator can change these details.</p>}
    </section>
  );
}

function DepartmentsTab({ d, users, act }: { d: C.CampusData; users: AdminUser[]; act: Act }) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <section className="panel">
        <h2 className="mb-2 text-lg font-bold">Add department · विभाग थप्नुहोस्</h2>
        <div className="flex gap-2"><input className="field" placeholder="e.g. Management, Education, Humanities" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" onClick={async () => { if (name.trim() && await act(C.addDepartment(name), "Department added.")) setName(""); }}>Add</button></div>
      </section>
      {d.departments.map((x) => {
        const heads = d.heads.filter((h) => h.department_id === x.id);
        const free = users.filter((u) => !heads.some((h) => h.user_id === u.id));
        return (
          <section key={x.id} className="panel">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 text-base font-bold">{x.name}</h3>
              <Dots items={[
                ["Rename", () => { const n = prompt("New name", x.name); if (n?.trim()) void act(C.renameDepartment(x.id, n), "Renamed."); }],
                ["Delete", () => confirm(`Delete department "${x.name}"? Only possible when it has no programs.`) && void act(C.deleteDepartment(x.id), "Deleted."), true],
              ]} />
            </div>
            <div className="mt-2 text-sm"><span className="text-muted-foreground">Department head(s): </span>
              {heads.length ? heads.map((h) => { const u = users.find((y) => y.id === h.user_id); return <span key={h.user_id} className="chip mr-1">{u?.name || u?.login || "—"} <button className="ml-1" title="Remove" onClick={() => void act(C.setHead(h.user_id, x.id, false), "Head removed.")}>×</button></span>; }) : <span className="text-muted-foreground">none yet</span>}
            </div>
            <select className="field mt-2 !w-64" value="" onChange={(e) => e.target.value && void act(C.setHead(e.target.value, x.id, true), "Department head appointed.")}>
              <option value="">+ Appoint a teacher as head…</option>
              {free.map((u) => <option key={u.id} value={u.id}>{u.name || u.login}</option>)}
            </select>
          </section>
        );
      })}
      {!d.departments.length && <p className="text-sm text-muted-foreground">No departments yet.</p>}
    </div>
  );
}

function StructureTab({ d, depts, act, canManage }: { d: C.CampusData; depts: C.Department[]; act: Act; canManage: boolean }) {
  const [dept, setDept] = useState(depts[0]?.id ?? "");
  const [prog, setProg] = useState("");
  const [kind, setKind] = useState<"Year" | "Semester">("Year");
  const [no, setNo] = useState(1);
  const [section, setSection] = useState("");
  useEffect(() => { if (!depts.some((x) => x.id === dept)) setDept(depts[0]?.id ?? ""); }, [depts, dept]);
  if (!canManage) {
    return <ReadOnlyTree d={d} />;
  }
  if (!depts.length) return <p className="text-sm text-muted-foreground">No department yet. The administrator creates departments first (Departments tab).</p>;
  const progs = d.programs.filter((p) => p.department_id === dept);
  const usedNames = progs.map((p) => p.name.toLowerCase());
  return (
    <div className="space-y-3">
      <div className="w-72"><label className="lbl">Department · विभाग</label><select className="field" value={dept} onChange={(e) => setDept(e.target.value)}>{depts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <section className="panel">
        <h2 className="mb-2 text-lg font-bold">Programs · कार्यक्रम</h2>
        <div className="mb-2 flex flex-wrap gap-1">
          {C.SUGGESTED_PROGRAMS.filter((n) => !usedNames.includes(n.toLowerCase())).map((n) => <button key={n} className="chip" onClick={() => void act(C.addProgram(dept, n), `${n} added.`)}>+ {n}</button>)}
        </div>
        <div className="flex gap-2"><input className="field" placeholder="Other program (type a name)" value={prog} onChange={(e) => setProg(e.target.value)} />
          <button className="btn" onClick={async () => { if (prog.trim() && await act(C.addProgram(dept, prog), "Program added.")) setProg(""); }}>Add</button></div>
      </section>
      {progs.map((p) => {
        const cls = d.classes.filter((c) => c.program_id === p.id).sort((a, b) => a.kind.localeCompare(b.kind) || a.no - b.no || a.section.localeCompare(b.section));
        return (
          <section key={p.id} className="panel">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 text-base font-bold">{p.name}</h3>
              <Dots items={[
                ["Rename", () => { const n = prompt("New program name", p.name); if (n?.trim()) void act(C.renameProgram(p.id, n), "Renamed."); }],
                ["Delete", () => confirm(`Delete program "${p.name}"? Only possible when it has no classes.`) && void act(C.deleteProgram(p.id), "Deleted."), true],
              ]} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {cls.map((c) => (
                <span key={c.id} className="chip">
                  {c.kind === "Year" ? `Year ${c.no}` : `Sem ${c.no}`}{c.section && ` (${c.section})`} · {d.students.filter((s) => s.class_id === c.id && s.active).length} students
                  <button className="ml-1" title="Delete class" onClick={() => confirm("Delete this class? Only possible when it has no students.") && void act(C.deleteClass(c.id), "Class deleted.")}>×</button>
                </span>
              ))}
              {!cls.length && <span className="text-sm text-muted-foreground">No classes yet.</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div><label className="lbl">Type</label><select className="field !w-32" value={kind} onChange={(e) => setKind(e.target.value as "Year" | "Semester")}><option>Year</option><option>Semester</option></select></div>
              <div><label className="lbl">No.</label><select className="field !w-20" value={no} onChange={(e) => setNo(Number(e.target.value))}>{Array.from({ length: kind === "Year" ? 5 : 12 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></div>
              <div><label className="lbl">Section (optional)</label><input className="field !w-28" value={section} onChange={(e) => setSection(e.target.value)} /></div>
              <button className="btn" onClick={() => void act(C.addClass(p.id, kind, no, section), "Class added.")}>+ Add class</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ReadOnlyTree({ d }: { d: C.CampusData }) {
  return (
    <div className="space-y-3">
      {d.departments.map((x) => (
        <section key={x.id} className="panel">
          <h3 className="mb-1 font-bold">{x.name}</h3>
          {d.programs.filter((p) => p.department_id === x.id).map((p) => (
            <div key={p.id} className="text-sm"><b>{p.name}</b>: {d.classes.filter((c) => c.program_id === p.id).map((c) => C.className(c, d.programs)).join(" · ") || "—"}</div>
          ))}
        </section>
      ))}
      {!d.departments.length && <p className="text-sm text-muted-foreground">Nothing has been set up yet.</p>}
    </div>
  );
}

function StudentsTab({ d, depts, act, setNote }: { d: C.CampusData; depts: C.Department[]; act: Act; setNote: (s: string) => void }) {
  const myProgs = d.programs.filter((p) => depts.some((x) => x.id === p.department_id));
  const myClasses = d.classes.filter((c) => myProgs.some((p) => p.id === c.program_id));
  const [cls, setCls] = useState("");
  const [bulk, setBulk] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string; roll: number } | null>(null);
  const [target, setTarget] = useState("");
  const all = d.students.filter((s) => s.class_id === cls).sort((a, b) => a.roll - b.roll || a.name.localeCompare(b.name));
  const list = showAll ? all : all.filter((s) => s.active);
  const label = (id: string) => { const c = d.classes.find((x) => x.id === id); return c ? C.className(c, d.programs) : "—"; };
  const nextRoll = (all.reduce((m, s) => Math.max(m, s.roll), 0) || 0) + 1;
  const others = myClasses.filter((c) => c.id !== cls);

  const bulkMove = async () => {
    const active = all.filter((s) => s.active);
    if (!target || !active.length) return;
    if (!confirm(`Upgrade ${active.length} active students from ${label(cls)} to ${label(target)}? Inactive students stay behind.`)) return;
    if (await act(C.moveStudents(active, target, label(target)), "Class upgraded.")) setTarget("");
  };

  return (
    <div className="space-y-3">
      <div className="w-80"><label className="lbl">Class · कक्षा</label>
        <select className="field" value={cls} onChange={(e) => { setCls(e.target.value); setMoving(null); setEdit(null); setNote(""); }}>
          <option value="">— Select class —</option>
          {depts.map((dep) => (
            <optgroup key={dep.id} label={dep.name}>
              {myClasses.filter((c) => d.programs.find((p) => p.id === c.program_id)?.department_id === dep.id).map((c) => <option key={c.id} value={c.id}>{C.className(c, d.programs)}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      {!cls && <p className="text-sm text-muted-foreground">Choose a class to see and manage its students. Create classes first in “Programs & classes”.</p>}
      {cls && (<>
        <section className="panel">
          <h2 className="mb-2 text-lg font-bold">Add students · विद्यार्थी थप्नुहोस्</h2>
          <textarea className="field min-h-24" placeholder="One name per line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <button className="btn mt-2" onClick={async () => { if (await act(C.addStudents(cls, bulk.split("\n"), nextRoll), "Students added (names already in the class are skipped).")) setBulk(""); }}>Add</button>
        </section>

        <section className="panel overflow-x-auto">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="flex-1 text-lg font-bold">{all.filter((s) => s.active).length} active · {all.length} total</h2>
            <label className="text-sm"><input type="checkbox" className="mr-1" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Show inactive</label>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="w-16 p-2">Roll</th><th className="p-2">Name</th><th className="p-2">Status</th><th className="w-12 p-2" /></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={`border-b border-border align-top ${s.active ? "" : "opacity-50"}`}>
                  <td className="p-2">{edit?.id === s.id ? <input className="field !w-16" type="number" value={edit.roll} onChange={(e) => setEdit({ ...edit, roll: Number(e.target.value) })} /> : s.roll}</td>
                  <td className="p-2">
                    {edit?.id === s.id ? (
                      <div className="flex gap-2"><input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                        <button className="btn" onClick={async () => { if (edit.name.trim() && await act(C.updateStudent(s.id, { name: edit.name.trim(), roll: edit.roll }), "Saved.")) setEdit(null); }}>Save</button>
                        <button className="btn-soft" onClick={() => setEdit(null)}>Cancel</button></div>
                    ) : s.name}
                    {moving === s.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select className="field !w-64" value="" onChange={async (e) => { const to = e.target.value; if (!to) return; if (await act(C.moveStudents([s], to, label(to)), `${s.name} moved.`)) setMoving(null); }}>
                          <option value="">Move to class…</option>{others.map((c) => <option key={c.id} value={c.id}>{C.className(c, d.programs)}</option>)}
                        </select><button className="btn-soft" onClick={() => setMoving(null)}>Cancel</button>
                      </div>
                    )}
                    {s.history.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{s.history.slice(-2).join(" · ")}</div>}
                  </td>
                  <td className="p-2">{s.active ? <span className="chip">Active</span> : <span className="chip">Inactive</span>}</td>
                  <td className="p-2 text-right">
                    <Dots items={[
                      ["Edit name / roll", () => setEdit({ id: s.id, name: s.name, roll: s.roll })],
                      [s.active ? "Make inactive" : "Make active", () => void act(C.updateStudent(s.id, { active: !s.active }), s.active ? "Marked inactive." : "Marked active.")],
                      ["Move / upgrade to another class", () => setMoving(s.id)],
                      ["Delete", () => confirm(`Delete ${s.name} permanently? Use “Make inactive” to keep the record.`) && void act(C.deleteStudent(s.id), "Deleted."), true],
                    ]} />
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">No students yet.</td></tr>}
            </tbody>
          </table>
        </section>

        {others.length > 0 && all.some((s) => s.active) && (
          <section className="panel">
            <h2 className="mb-1 text-lg font-bold">Upgrade the whole class · अर्को कक्षामा पठाउने</h2>
            <p className="mb-2 text-xs text-muted-foreground">Moves all ACTIVE students to the class you choose (for example Year 1 → Year 2). Make leavers inactive first.</p>
            <div className="flex flex-wrap gap-2">
              <select className="field !w-72" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Move to…</option>{others.map((c) => <option key={c.id} value={c.id}>{C.className(c, d.programs)}</option>)}</select>
              <button className="btn" disabled={!target} onClick={() => void bulkMove()}>Upgrade</button>
            </div>
          </section>
        )}
      </>)}
    </div>
  );
}
