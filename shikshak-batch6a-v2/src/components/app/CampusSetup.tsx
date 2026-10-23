import { useCallback, useEffect, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { adminListUsers, type AdminUser, type Result } from "@/lib/admin.functions";
import * as C from "@/lib/campus";
import type { R } from "@/lib/sqc-data";

type Act = <X>(p: Promise<R<X>>, ok?: string) => Promise<boolean>;

/**
 * Campus set-up, shown inside Setup: institutional profile -> departments -> classes -> students.
 * Everyone signed in can LOOK; only the administrator (and a department head, for their own
 * department's classes and students) can change. The database enforces this too.
 */
export function CampusSetup() {
  const cl = useCloud();
  const admin = cl.roles.includes("admin");
  const [d, setD] = useState<C.CampusData | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [dept, setDept] = useState("");
  const [cls, setCls] = useState("");

  const load = useCallback(async () => {
    const r = await C.loadCampus();
    if (r.ok) { setD(r.data); setErr(""); } else setErr(r.error);
  }, []);
  useEffect(() => { if (cl.status === "ready" && cl.userId) void load(); }, [cl.status, cl.userId, load]);
  useEffect(() => {
    if (!admin) return;
    (async () => {
      try { const u = (await (adminListUsers as any)({ data: {} })) as Result<{ users: AdminUser[] }>; if (u.ok) setUsers(u.users.filter((x) => x.roles.includes("teacher") || x.roles.includes("admin"))); } catch { /* ignore */ }
    })();
  }, [admin]);

  const act: Act = async (p, ok = "Saved.") => {
    const r = await p;
    setNote(r.ok ? ok : r.error);
    if (r.ok) await load();
    return r.ok;
  };

  if (cl.status !== "ready" || !cl.userId) return null;
  if (err && !d) return <section className="panel no-print mb-4"><h2 className="mb-2 text-lg font-bold">Campus · क्याम्पस</h2><p className="rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p><button className="btn-soft mt-2" onClick={() => void load()}>Try again</button></section>;
  if (!d) return <section className="panel no-print mb-4"><p className="text-sm text-muted-foreground">Loading campus set-up…</p></section>;

  const myDepts = d.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);
  const manage = (deptId: string) => admin || myDepts.includes(deptId);
  const curDept = d.departments.find((x) => x.id === dept);
  const curClass = d.classes.find((x) => x.id === cls);
  const canClass = !!curDept && manage(curDept.id);

  return (
    <section className="panel no-print mb-4">
      <Institution d={d} admin={admin} act={act} />
      {note && <p className="my-3 rounded-md border border-primary p-2 text-sm">{note}</p>}

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="mb-2 text-base font-bold">Departments · विभाग</h3>
        <div className="flex flex-wrap gap-2">
          {d.departments.map((x) => (
            <button key={x.id} className={dept === x.id ? "chip-on" : "chip"} onClick={() => { setDept(x.id); setCls(""); setNote(""); }}>{x.name}</button>
          ))}
          {!d.departments.length && <span className="text-sm text-muted-foreground">No departments yet.{admin ? "" : " The administrator will add them."}</span>}
        </div>
        {admin && <AddOne placeholder="New department (e.g. Management, Education)" onAdd={(v) => act(C.addDepartment(v), "Department added.")} />}
      </div>

      {curDept && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-base font-bold">{curDept.name}</h3>
            {admin && <>
              <button className="btn-soft" onClick={() => { const n = prompt("New department name", curDept.name); if (n?.trim()) void act(C.renameDepartment(curDept.id, n), "Renamed."); }}>Rename</button>
              <button className="btn-danger" onClick={() => { if (confirm(`Delete department "${curDept.name}"? Only possible when it has no classes.`)) void act(C.deleteDepartment(curDept.id), "Deleted.").then((ok) => ok && setDept("")); }}>Remove</button>
            </>}
          </div>
          <Heads d={d} dept={curDept} users={users} admin={admin} act={act} />

          <h4 className="mb-2 mt-4 font-semibold">Classes · कक्षा</h4>
          <div className="flex flex-wrap gap-2">
            {d.classes.filter((c) => c.department_id === curDept.id).map((c) => (
              <button key={c.id} className={cls === c.id ? "chip-on" : "chip"} onClick={() => { setCls(c.id); setNote(""); }}>
                {c.name} · {d.students.filter((s) => s.class_id === c.id && s.active).length}
              </button>
            ))}
            {!d.classes.some((c) => c.department_id === curDept.id) && <span className="text-sm text-muted-foreground">No classes yet.</span>}
          </div>
          {canClass && <AddOne placeholder="New class (e.g. BBS I, BBS II, M.Ed 1st Sem)" onAdd={(v) => act(C.addClass(curDept.id, v), "Class added.")} />}
        </div>
      )}

      {curClass && curDept && <Students d={d} cls={curClass} manage={canClass} act={act} setNote={setNote} onGone={() => setCls("")} allManageable={d.classes.filter((c) => manage(c.department_id))} />}
    </section>
  );
}

function AddOne({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => Promise<boolean> }) {
  const [v, setV] = useState("");
  return (
    <div className="mt-2 flex gap-2">
      <input className="field" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) void onAdd(v).then((ok) => ok && setV("")); }} />
      <button className="btn" onClick={async () => { if (v.trim() && await onAdd(v)) setV(""); }}>Add</button>
    </div>
  );
}

function Institution({ d, admin, act }: { d: C.CampusData; admin: boolean; act: Act }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<C.CampusProfile>(d.profile);
  const p = d.profile;
  const F = (k: keyof C.CampusProfile, l: string, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}><label className="lbl">{l}</label><input className="field" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  if (edit && admin) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-bold">Institutional profile · संस्थागत विवरण</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {F("name", "Campus name · क्याम्पसको नाम", true)}{F("address", "Address · ठेगाना", true)}
          {F("website", "Website")}{F("email", "Email")}{F("phone", "Phone · फोन नं.")}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={async () => { if (await act(C.saveProfile(f))) setEdit(false); }}>Save</button>
          <button className="btn-soft" onClick={() => { setF(p); setEdit(false); }}>Cancel</button>
        </div>
      </div>
    );
  }
  const line = [p.address, p.phone, p.email, p.website].filter(Boolean);
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">Institutional profile · संस्थागत विवरण</div>
        <h2 className="font-display text-2xl text-primary">{p.name || "Campus name not set"}</h2>
        {line.length > 0 ? <p className="text-sm text-muted-foreground">{line.join(" · ")}</p> : <p className="text-sm text-muted-foreground">{admin ? "Add the campus address, phone, email and website." : "Details have not been added yet."}</p>}
      </div>
      {admin && <button className="btn-soft" onClick={() => { setF(p); setEdit(true); }}>Edit profile</button>}
    </div>
  );
}

function Heads({ d, dept, users, admin, act }: { d: C.CampusData; dept: C.Department; users: AdminUser[]; admin: boolean; act: Act }) {
  const heads = d.heads.filter((h) => h.department_id === dept.id);
  const free = users.filter((u) => !heads.some((h) => h.user_id === u.id));
  const nameOf = (id: string) => { const u = users.find((y) => y.id === id); return u ? (u.name || u.login) : "Department head"; };
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">Department head: </span>
      {heads.length ? heads.map((h) => (
        <span key={h.user_id} className="chip mr-1">{nameOf(h.user_id)}{admin && <button className="ml-1" title="Remove" onClick={() => void act(C.setHead(h.user_id, dept.id, false), "Head removed.")}>×</button>}</span>
      )) : <span className="text-muted-foreground">not appointed</span>}
      {admin && (
        <select className="field mt-2 !w-64" value="" onChange={(e) => e.target.value && void act(C.setHead(e.target.value, dept.id, true), "Department head appointed.")}>
          <option value="">+ Appoint a teacher as head…</option>
          {free.map((u) => <option key={u.id} value={u.id}>{u.name || u.login}</option>)}
        </select>
      )}
    </div>
  );
}

function Students({ d, cls, manage, act, setNote, onGone, allManageable }: { d: C.CampusData; cls: C.CampusClass; manage: boolean; act: Act; setNote: (s: string) => void; onGone: () => void; allManageable: C.CampusClass[] }) {
  const [bulk, setBulk] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string; roll: number } | null>(null);
  const [target, setTarget] = useState("");
  const all = d.students.filter((s) => s.class_id === cls.id).sort((a, b) => a.roll - b.roll || a.name.localeCompare(b.name));
  const list = showAll ? all : all.filter((s) => s.active);
  const label = (id: string) => d.classes.find((x) => x.id === id)?.name ?? "—";
  const nextRoll = all.reduce((m, s) => Math.max(m, s.roll), 0) + 1;
  const others = allManageable.filter((c) => c.id !== cls.id);

  const bulkMove = async () => {
    const active = all.filter((s) => s.active);
    if (!target || !active.length) return;
    if (!confirm(`Upgrade ${active.length} active students from ${cls.name} to ${label(target)}? Inactive students stay behind.`)) return;
    if (await act(C.moveStudents(active, target, label(target)), "Class upgraded.")) setTarget("");
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-base font-bold">{cls.name} · Students · विद्यार्थी <span className="text-sm font-normal text-muted-foreground">({all.filter((s) => s.active).length} active)</span></h3>
        {manage && <>
          <button className="btn-soft" onClick={() => { const n = prompt("New class name", cls.name); if (n?.trim()) void act(C.renameClass(cls.id, n), "Renamed."); }}>Rename class</button>
          <button className="btn-danger" onClick={() => { if (confirm(`Remove class "${cls.name}"? Only possible when it has no students.`)) void act(C.deleteClass(cls.id), "Class removed.").then((ok) => ok && onGone()); }}>Remove class</button>
        </>}
      </div>

      {manage && (
        <div className="mb-3">
          <textarea className="field min-h-20" placeholder="Add students: one name per line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <button className="btn mt-2" onClick={async () => { if (await act(C.addStudents(cls.id, bulk.split("\n"), nextRoll), "Students added (names already in the class are skipped).")) setBulk(""); }}>Add students</button>
        </div>
      )}

      <label className="mb-2 block text-sm"><input type="checkbox" className="mr-1" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Show inactive students too</label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="w-16 p-2">Roll</th><th className="p-2">Name</th>{manage && <th className="p-2 text-right">Action</th>}</tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className={`border-b border-border align-top ${s.active ? "" : "opacity-50"}`}>
                <td className="p-2">{edit?.id === s.id ? <input className="field !w-16" type="number" value={edit.roll} onChange={(e) => setEdit({ ...edit, roll: Number(e.target.value) })} /> : s.roll}</td>
                <td className="p-2">
                  {edit?.id === s.id
                    ? <input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                    : <>{s.name}{!s.active && <span className="chip ml-2">inactive</span>}</>}
                  {moving === s.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select className="field !w-60" value="" onChange={async (e) => { const to = e.target.value; if (to && await act(C.moveStudents([s], to, label(to)), `${s.name} moved.`)) setMoving(null); }}>
                        <option value="">Move to class…</option>{others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select><button className="btn-soft" onClick={() => setMoving(null)}>Cancel</button>
                    </div>
                  )}
                  {s.history.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{s.history.slice(-2).join(" · ")}</div>}
                </td>
                {manage && (
                  <td className="p-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {edit?.id === s.id ? <>
                        <button className="btn" onClick={async () => { if (edit.name.trim() && await act(C.updateStudent(s.id, { name: edit.name.trim(), roll: edit.roll }), "Saved.")) setEdit(null); }}>Save</button>
                        <button className="btn-soft" onClick={() => setEdit(null)}>Cancel</button>
                      </> : <>
                        <button className="btn-soft" onClick={() => setEdit({ id: s.id, name: s.name, roll: s.roll })}>Edit</button>
                        <button className="btn-soft" onClick={() => void act(C.updateStudent(s.id, { active: !s.active }), s.active ? "Marked inactive." : "Marked active.")}>{s.active ? "Inactive" : "Activate"}</button>
                        {others.length > 0 && <button className="btn-soft" onClick={() => setMoving(s.id)}>Move</button>}
                        <button className="btn-danger" onClick={() => confirm(`Remove ${s.name} permanently? Use “Inactive” to keep the record.`) && void act(C.deleteStudent(s.id), "Removed.")}>Remove</button>
                      </>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!list.length && <tr><td colSpan={3} className="p-3 text-muted-foreground">No students yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {manage && others.length > 0 && all.some((s) => s.active) && (
        <div className="mt-3 rounded-md border border-border p-3">
          <h4 className="mb-1 font-semibold">Upgrade the whole class · अर्को कक्षामा पठाउने</h4>
          <p className="mb-2 text-xs text-muted-foreground">Moves all ACTIVE students to the class you choose (for example BBS I → BBS II). Mark leavers inactive first.</p>
          <div className="flex flex-wrap gap-2">
            <select className="field !w-64" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Move to…</option>{others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button className="btn" disabled={!target} onClick={() => void bulkMove()}>Upgrade</button>
          </div>
        </div>
      )}
      {!manage && <p className="mt-3 text-xs text-muted-foreground">You can view this class. Only the administrator and this department's head can change it.</p>}
    </div>
  );
}
