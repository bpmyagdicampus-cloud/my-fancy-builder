import { useState } from "react";
import { Tabs } from "@/components/app/ui";
import { deleteClass, deletePeriod, removeMember, saveClass, savePeriod, setMember, type Membership } from "@/lib/sqc-data";
import { className, hhmm, type Period, type SqcClass } from "@/lib/sqc";

export type StudentUser = { id: string; name: string; login: string };
type T = "classes" | "members" | "periods";

export function SqcSetup({ classes, periods, members, students, onChanged }: {
  classes: SqcClass[]; periods: Period[]; members: Membership[]; students: StudentUser[]; onChanged: () => void;
}) {
  const [tab, setTab] = useState<T>("classes");
  const [note, setNote] = useState("");
  const done = (r: { ok: boolean; error?: string }, ok = "") => { if (!r.ok) setNote((r as { error: string }).error); else { setNote(ok); onChanged(); } };

  // classes
  const [nc, setNc] = useState({ name: "", section: "" });
  // members
  const [nm, setNm] = useState({ user: "", cls: "", rep: false });
  // periods
  const [pd, setPd] = useState<Record<number, { s: string; e: string }>>({});
  const pv = (n: number) => pd[n] ?? { s: hhmm(periods.find((p) => p.period_no === n)?.start_time), e: hhmm(periods.find((p) => p.period_no === n)?.end_time) };

  return (
    <div>
      <Tabs value={tab} onChange={setTab} items={[["classes", "Classes · कक्षा"], ["members", "Students & representatives · विद्यार्थी"], ["periods", "Period times · पिरियड समय"]]} />
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}

      {tab === "classes" && (
        <div className="panel space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div><label className="lbl">Class name</label><input className="field" placeholder="BBS I" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></div>
            <div><label className="lbl">Section (optional)</label><input className="field" placeholder="A" value={nc.section} onChange={(e) => setNc({ ...nc, section: e.target.value })} /></div>
            <button className="btn" onClick={async () => { if (!nc.name.trim()) return setNote("Enter the class name."); const r = await saveClass(nc); if (r.ok) setNc({ name: "", section: "" }); done(r, "Class added."); }}>Add class</button>
          </div>
          <ul className="space-y-1 text-sm">
            {classes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 border-b border-border py-1">
                <span className="flex-1 font-medium">{className(c)}</span>
                <span className="text-xs text-muted-foreground">{members.filter((m) => m.class_id === c.id).length} students · {members.filter((m) => m.class_id === c.id && m.is_rep).length} rep</span>
                <button className="btn-soft" onClick={async () => { const n = prompt("Class name", c.name); if (n === null) return; const s = prompt("Section", c.section); if (s === null) return; done(await saveClass({ id: c.id, name: n, section: s }), "Saved."); }}>Rename</button>
                <button className="btn-danger" onClick={async () => confirm(`Delete ${className(c)}? (not possible if it already has reports)`) && done(await deleteClass(c.id), "Deleted.")}>Delete</button>
              </li>
            ))}
            {!classes.length && <li className="text-muted-foreground">No classes yet.</li>}
          </ul>
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-3">
          <div className="panel flex flex-wrap items-end gap-2">
            <div><label className="lbl">Student account</label>
              <select className="field" value={nm.user} onChange={(e) => setNm({ ...nm, user: e.target.value })}><option value="">— Select —</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name || s.login} ({s.login})</option>)}</select></div>
            <div><label className="lbl">Class</label>
              <select className="field" value={nm.cls} onChange={(e) => setNm({ ...nm, cls: e.target.value })}><option value="">— Select —</option>{classes.map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}</select></div>
            <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" checked={nm.rep} onChange={(e) => setNm({ ...nm, rep: e.target.checked })} />Class representative</label>
            <button className="btn" onClick={async () => { if (!nm.user || !nm.cls) return setNote("Choose a student and a class."); done(await setMember({ user_id: nm.user, class_id: nm.cls, is_rep: nm.rep }), "Saved."); }}>Add / update</button>
            <p className="w-full text-xs text-muted-foreground">Create student accounts in Admin → New account (role: Student). Only a class representative can submit reports, and only for their own class.</p>
          </div>
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-2">Student</th><th className="p-2">Class</th><th className="p-2">Representative</th><th className="p-2"></th></tr></thead>
              <tbody>
                {members.map((m) => {
                  const s = students.find((x) => x.id === m.user_id);
                  return (
                    <tr key={m.user_id + m.class_id} className="border-b border-border">
                      <td className="p-2">{s ? `${s.name || s.login}` : m.user_id.slice(0, 8)}</td>
                      <td className="p-2">{className(classes.find((c) => c.id === m.class_id))}</td>
                      <td className="p-2"><input type="checkbox" checked={m.is_rep} onChange={async (e) => done(await setMember({ ...m, is_rep: e.target.checked }))} /></td>
                      <td className="p-2"><button className="btn-danger" onClick={async () => confirm("Remove this student from the class?") && done(await removeMember(m.user_id, m.class_id), "Removed.")}>Remove</button></td>
                    </tr>
                  );
                })}
                {!members.length && <tr><td colSpan={4} className="p-2 text-muted-foreground">No students assigned yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "periods" && (
        <div className="panel overflow-x-auto">
          <p className="mb-2 text-xs text-muted-foreground">Scheduled start and end of each period. Used to calculate how late a teacher arrived. Leave a period empty if it is not used.</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-2">Period</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2"></th></tr></thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                const v = pv(n);
                return (
                  <tr key={n} className="border-b border-border">
                    <td className="p-2 font-medium">{n}</td>
                    <td className="p-2"><input className="field !w-32" type="time" value={v.s} onChange={(e) => setPd({ ...pd, [n]: { ...v, s: e.target.value } })} /></td>
                    <td className="p-2"><input className="field !w-32" type="time" value={v.e} onChange={(e) => setPd({ ...pd, [n]: { ...v, e: e.target.value } })} /></td>
                    <td className="flex gap-1 p-2">
                      <button className="btn-soft" onClick={async () => { if (!v.s || !v.e) return setNote("Enter both start and end."); if (v.e <= v.s) return setNote("End must be after start."); done(await savePeriod({ period_no: n, start_time: v.s, end_time: v.e }), `Period ${n} saved.`); }}>Save</button>
                      {periods.some((p) => p.period_no === n) && <button className="btn-danger" onClick={async () => done(await deletePeriod(n), `Period ${n} cleared.`)}>Clear</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
