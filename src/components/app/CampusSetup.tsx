import { useCallback, useEffect, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { adminListUsers, type AdminUser, type Result } from "@/lib/admin.functions";
import * as C from "@/lib/campus";
import type { R } from "@/lib/sqc-data";

type Act = <X>(p: Promise<R<X>>, ok?: string) => Promise<boolean>;

/**
 * Campus set-up, shown inside Setup: institutional profile -> departments (with heads). Classes live in the Classes section of Setup.
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
    const curDept = d.departments.find((x) => x.id === dept);

  return (
    <section className="panel no-print mb-4">
      <Institution d={d} admin={admin} act={act} />
      {note && <p className="my-3 rounded-md border border-primary p-2 text-sm">{note}</p>}

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="mb-2 text-base font-bold">Departments · विभाग</h3>
        <div className="flex flex-wrap gap-2">
          {d.departments.map((x) => (
            <button key={x.id} className={dept === x.id ? "chip-on" : "chip"} onClick={() => { setDept(x.id); setNote(""); }}>{x.name}</button>
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

          <h4 className="mb-2 mt-4 font-semibold">Classes in this department · कक्षा</h4>
          <div className="flex flex-wrap gap-2">
            {d.classes.filter((c) => c.department_id === curDept.id).map((c) => <span key={c.id} className="chip">{c.name}</span>)}
            {!d.classes.some((c) => c.department_id === curDept.id) && <span className="text-sm text-muted-foreground">No classes yet.</span>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">New classes are created in the <b>Classes</b> section below (choose the department there). They are also used by SQC.</p>
        </div>
      )}

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
