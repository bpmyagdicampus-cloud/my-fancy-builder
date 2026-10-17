import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, Tabs, Collection, ClassSelect, BsDate, Dt, NeedProfile } from "@/components/app/ui";
import { updateData, uid, useTeacher, studentsOf, type Assess } from "@/lib/store";
import { todayBs } from "@/lib/bs";
import { ACT_CATS, ASSESS_KINDS, RUBRIC } from "@/lib/constants";

export const Route = createFileRoute("/records")({
  head: () => ({ meta: [
    { title: "Records — Shikshak Diary" },
    { name: "description", content: "Student assessments and exams with comments, research and other activities, reminders." },
    { property: "og:title", content: "Records — Shikshak Diary" },
    { property: "og:description", content: "Student assessments, exams, activities and reminders." },
  ] }),
  component: Records,
});

function Records() {
  const { profile } = useTeacher();
  const [tab, setTab] = useState<"assess" | "acts" | "rem">("assess");
  if (!profile) return <NeedProfile />;
  return (
    <Page title="Records">
      <Tabs value={tab} onChange={setTab} items={[["assess", "Student assessment & exams"], ["acts", "Research & other activities"], ["rem", "Reminders"]]} />
      {tab === "assess" && <Assessments />}
      {tab === "acts" && <Collection k="acts" title="Activities beyond teaching"
        fields={[{ k: "date", l: "Date", t: "date" }, { k: "category", l: "Category", t: "sel", opts: ACT_CATS }, { k: "title", l: "Title", wide: true }, { k: "details", l: "Details / outcome", t: "area" }]}
        summary={(a) => <><b>{a.category}</b> — {a.title}<div className="text-xs text-muted-foreground"><Dt d={a.date} /></div></>} />}
      {tab === "rem" && <Collection k="reminders" title="Reminders & future tasks" sort={(a, b) => a.date.localeCompare(b.date)}
        fields={[{ k: "date", l: "Date", t: "date" }, { k: "time", l: "Time", t: "time" }, { k: "title", l: "Task", wide: true }, { k: "note", l: "Note", t: "area" }, { k: "status", l: "Status", t: "sel", opts: ["Pending", "Done"] }]}
        summary={(r) => <><b><Dt d={r.date} /> {r.time}</b> — {r.title} <span className={r.status === "Done" ? "chip" : "chip-on"}>{r.status}</span></>} />}
    </Page>
  );
}

function Assessments() {
  const { data } = useTeacher();
  const [cls, setCls] = useState("");
  const [ed, setEd] = useState<Assess | null>(null);
  const c = data.classes.find((x) => x.id === (ed?.classId || cls));
  const stu = studentsOf(c);
  const isRubric = ed?.kind === "Unit assessment (rubric)";
  const setMark = (s: string, k: "m" | "c", v: string) => setEd((e) => e && { ...e, marks: { ...e.marks, [s]: { m: "", c: "", ...e.marks[s], [k]: v } } });
  const save = () => {
    if (!ed?.classId) return alert("Select a class");
    updateData((d) => { const i = d.assess.findIndex((x) => x.id === ed.id); if (i >= 0) d.assess[i] = ed; else d.assess.push({ ...ed, id: uid() }); });
    setEd(null);
  };
  const list = data.assess.filter((a) => !cls || a.classId === cls).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="panel">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-72"><ClassSelect all value={cls} onChange={setCls} /></div>
        <div className="flex-1" />
        {!ed && <button className="btn" onClick={() => setEd({ id: "", classId: cls, date: todayBs(), kind: ASSESS_KINDS[0], title: "", max: 10, marks: {} })}>+ New assessment</button>}
      </div>
      {ed && (
        <div className="mb-4 space-y-3 rounded-lg border border-primary/30 bg-secondary/40 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="lbl">Class</label><ClassSelect value={ed.classId} onChange={(v) => setEd({ ...ed, classId: v })} /></div>
            <div><label className="lbl">Date</label><BsDate value={ed.date} onChange={(v) => setEd({ ...ed, date: v })} /></div>
            <div><label className="lbl">Type</label><select className="field" value={ed.kind} onChange={(e) => setEd({ ...ed, kind: e.target.value, max: e.target.value === "Unit assessment (rubric)" ? 100 : ed.max })}>{ASSESS_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="lbl">Title / topic</label><input className="field" value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} /></div>
            <div><label className="lbl">Full marks</label><input type="number" className="field" value={ed.max} onChange={(e) => setEd({ ...ed, max: +e.target.value })} /></div>
          </div>
          {isRubric && <div className="text-xs text-muted-foreground">Rubric (100): {RUBRIC.map(([n, m]) => `${n} ${m}`).join(" · ")} — grades A Excellent, B Good, C Satisfactory, D Needs improvement.</div>}
          {stu.length ? (
            <table className="rtable text-sm">
              <thead><tr><th>#</th><th>Student</th><th className="w-24">Marks</th><th>Teacher's comment / feedback</th></tr></thead>
              <tbody>{stu.map((s, i) => (
                <tr key={s}><td>{i + 1}</td><td>{s}</td>
                  <td><input className="field py-1" value={ed.marks[s]?.m ?? ""} onChange={(e) => setMark(s, "m", e.target.value)} /></td>
                  <td><input className="field py-1" value={ed.marks[s]?.c ?? ""} onChange={(e) => setMark(s, "c", e.target.value)} /></td></tr>
              ))}</tbody>
            </table>
          ) : <p className="text-sm text-muted-foreground">Add student names to this class in Setup to record marks.</p>}
          <div className="flex gap-2">
            <button className="btn" onClick={save}>Save</button>
            <button className="btn-soft" onClick={() => setEd(null)}>Cancel</button>
            {ed.id && <button className="btn-danger ml-auto" onClick={() => { if (confirm("Delete?")) { updateData((d) => { d.assess = d.assess.filter((x) => x.id !== ed.id); }); setEd(null); } }}>Delete</button>}
          </div>
        </div>
      )}
      <ul className="divide-y divide-border">
        {list.map((a) => {
          const cc = data.classes.find((x) => x.id === a.classId);
          return <li key={a.id} className="cursor-pointer py-2 text-sm hover:bg-muted/50" onClick={() => setEd(structuredClone(a))}><b>{a.kind}</b> — {a.title}<div className="text-xs text-muted-foreground"><Dt d={a.date} /> · {cc?.name} {cc?.subject} · FM {a.max} · {Object.values(a.marks).filter((m) => m.m !== "").length} marked</div></li>;
        })}
        {!list.length && <li className="py-2 text-sm text-muted-foreground">No assessments yet.</li>}
      </ul>
    </section>
  );
}
