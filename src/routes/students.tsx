import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, ClassSelect, NeedProfile } from "@/components/app/ui";
import { updateData, useTeacher, type Data } from "@/lib/store";
import { addStudents, classStudents, importMissing, missingNames, moveStudents, renameStudent, setActive, setRoll } from "@/lib/students";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [
    { title: "Upgrade Students — Shikshak Diary" },
    { name: "description", content: "Student lists, roll numbers, renaming and moving students between classes." },
    { property: "og:title", content: "Upgrade Students — Shikshak Diary" },
    { property: "og:description", content: "Student lists, roll numbers, renaming and moving students between classes." },
  ] }),
  component: Students,
});

function Students() {
  const { profile, data } = useTeacher();
  const [cls, setCls] = useState("");
  const [bulk, setBulk] = useState("");
  const [note, setNote] = useState("");
  if (!profile) return <NeedProfile />;
  const open = data.classes.filter((c) => !c.closed);
  const list = cls ? classStudents(data, cls, false) : [];
  const missing = cls ? missingNames(data, cls) : [];
  const run = (fn: (d: typeof data) => string | null | void) => {
    let msg: string | null | void = null;
    updateData((d) => { msg = fn(d); });
    if (msg) setNote(String(msg)); else setNote("");
  };

  return (
    <Page title="Upgrade Students · विद्यार्थी अपग्रेड" sub="Each student has a permanent ID. Renaming a student updates old attendance and marks of this year automatically.">
      <div className="no-print mb-3 w-72"><ClassSelect active value={cls} onChange={(v) => { setCls(v); setNote(""); }} /></div>
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      <BulkMove run={run} />
      {!cls && <p className="text-sm text-muted-foreground">Choose a class to see and edit its students, or move a whole class above.</p>}
      {cls && (
        <>
          <section className="panel mb-4">
            <h2 className="mb-2 text-lg font-bold">Add students</h2>
            <textarea className="field min-h-24" placeholder="One name per line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn" onClick={() => { run((d) => { const r = addStudents(d, cls, bulk.split("\n")); return `${r.added.length} added${r.skipped.length ? `; already in the class: ${r.skipped.join(", ")}` : ""}.`; }); setBulk(""); }}>Add</button>
              {missing.length > 0 && (
                <button className="btn-soft" onClick={() => confirm(`Add ${missing.length} names found in this class's attendance/marks but missing from the list?`) && run((d) => `${importMissing(d, cls).added.length} students added from old records.`)}>
                  Add {missing.length} names found in old records
                </button>
              )}
            </div>
          </section>

          <section className="panel overflow-x-auto">
            <h2 className="mb-2 text-lg font-bold">{list.filter((s) => s.active).length} active · {list.length} total</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="w-20 p-2">Roll</th><th className="p-2">Name</th><th className="p-2">Active</th><th className="p-2">Move to class</th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id + s.name + s.roll} className={`border-b border-border ${s.active ? "" : "opacity-50"}`}>
                    <td className="p-2"><input className="field !w-16" type="number" defaultValue={s.roll} onBlur={(e) => +e.target.value !== s.roll && run((d) => setRoll(d, s.id, +e.target.value))} /></td>
                    <td className="p-2"><input className="field" defaultValue={s.name}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      onBlur={(e) => { if (e.target.value.trim() === s.name) return; let err: string | null = null; updateData((d) => { err = renameStudent(d, s.id, e.target.value); }); if (err) { setNote(err); e.target.value = s.name; } else setNote(""); }} /></td>
                    <td className="p-2"><input type="checkbox" checked={s.active} onChange={(e) => run((d) => setActive(d, s.id, e.target.checked))} title="Untick when the student has left" /></td>
                    <td className="p-2">
                      <select className="field !w-auto" value="" onChange={(e) => {
                        const to = e.target.value; if (!to) return;
                        const t = open.find((c) => c.id === to);
                        if (confirm(`Move ${s.name} to ${t?.name} · ${t?.subject}? Past attendance stays in the old class.`)) run((d) => { const r = moveStudents(d, [s.id], to); return r.conflicts.length ? `Could not move: ${r.conflicts.join(", ")} (same name exists there).` : `${s.name} moved.`; });
                      }}>
                        <option value="">Move…</option>
                        {open.filter((c) => c.id !== cls).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">No students yet.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </Page>
  );
}

/** Move every student of one class to another class in one step. Active / inactive is never changed. */
function BulkMove({ run }: { run: (fn: (d: Data) => string | null | void) => void }) {
  const { data } = useTeacher();
  const open = data.classes.filter((c) => !c.closed);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [withInactive, setWithInactive] = useState(true);
  const src = open.find((c) => c.id === from);
  const dst = open.find((c) => c.id === to);
  // counted from the full student registry of the class, never from what happens to be on screen
  const pool = data.students.filter((s) => s.classId === from && (withInactive || s.active));
  const active = pool.filter((s) => s.active).length;
  const go = () => {
    if (!src || !dst) return;
    if (src.id === dst.id) { alert("Choose two different classes."); return; }
    if (!pool.length) { alert("This class has no students to move."); return; }
    const msg = `Move ${pool.length} students (${active} active, ${pool.length - active} inactive)\nfrom ${src.name} · ${src.subject}\nto ${dst.name} · ${dst.subject}?\n\nActive / inactive stays as it is. Past attendance and marks stay in the old class.`;
    if (!confirm(msg)) return;
    const ids = pool.map((s) => s.id);
    run((d) => {
      const r = moveStudents(d, ids, dst.id);
      return `${r.moved.length} of ${ids.length} students moved to ${dst.name} · ${dst.subject}.${r.conflicts.length ? ` NOT moved (${r.conflicts.length}): ${r.conflicts.join(", ")}. The same name already exists in the new class.` : ""}`;
    });
    setFrom("");
  };
  return (
    <section className="panel no-print mb-4">
      <h2 className="mb-2 text-lg font-bold">Move a whole class · एउटा कक्षाका सबै विद्यार्थी सार्नुहोस्</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className="lbl">From class</label>
          <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">— Select —</option>{open.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
          </select></div>
        <div><label className="lbl">To class</label>
          <select className="field" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">— Select —</option>{open.filter((c) => c.id !== from).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
          </select></div>
      </div>
      <label className="mt-2 block text-sm"><input type="checkbox" className="mr-1" checked={withInactive} onChange={(e) => setWithInactive(e.target.checked)} />Also move inactive students (they stay inactive)</label>
      {from && <p className="mt-1 text-xs text-muted-foreground">{pool.length} students will be moved ({active} active).</p>}
      <button className="btn mt-2" disabled={!from || !to} onClick={go}>Move all students</button>
    </section>
  );
}
