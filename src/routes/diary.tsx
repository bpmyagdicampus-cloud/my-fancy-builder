import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, BsDate, ClassSelect, NeedProfile, Dt } from "@/components/app/ui";
import { updateData, uid, useTeacher, studentsOf, type Diary } from "@/lib/store";
import { todayBs, weekday, inRange, fmtBs } from "@/lib/bs";
import { CODES, HOLIDAY_TYPES } from "@/lib/constants";
import { weeklyOffOf } from "@/lib/migrate";

export const Route = createFileRoute("/diary")({
  head: () => ({ meta: [
    { title: "Daily Diary — Shikshak Diary" },
    { name: "description", content: "Record daily classes: attendance, absence reasons, activities, methods, feedback and evaluation." },
    { property: "og:title", content: "Daily Diary — Shikshak Diary" },
    { property: "og:description", content: "Record daily classes: attendance, activities, methods and feedback." },
  ] }),
  component: DiaryPage,
});

const blank = (classId = ""): Diary => ({ id: "", classId, date: todayBs(), total: 0, absent: [], reasons: "", codes: [], lh: 1, unitId: "", topic: "", methods: "", studentActs: "", feedback: "", evaluation: "", remarks: "" });

function DiaryPage() {
  const { profile, data } = useTeacher();
  const [ed, setEd] = useState<Diary | null>(null);
  const [fc, setFc] = useState("");
  if (!profile) return <NeedProfile />;
  const cls = data.classes.find((c) => c.id === ed?.classId);
  const stu = studentsOf(cls);
  const set = (p: Partial<Diary>) => setEd((e) => (e ? { ...e, ...p } : e));
  const pickClass = (id: string) => { const c = data.classes.find((x) => x.id === id); set({ classId: id, total: studentsOf(c).length, absent: [], unitId: "" }); };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const save = () => {
    if (!ed?.classId) return alert("Select a class");
    const isOff = weeklyOffOf(data).includes(weekday(ed.date));
    const isHoliday = data.cal.some((e) => HOLIDAY_TYPES.includes(e.type) && inRange(ed.date, e.from, e.to));
    const onLeave = data.leaves.some((l) => inRange(ed.date, l.from, l.to));
    if ((isOff || isHoliday || onLeave) && !confirm(`${fmtBs(ed.date)} is marked as ${isOff ? "a weekly holiday" : isHoliday ? "a holiday" : "your leave"}. Save this entry anyway?`)) return;
    if (data.diary.some((x) => x.id !== ed.id && x.classId === ed.classId && x.date === ed.date) && !confirm("An entry for this class on this date already exists. Save another one?")) return;
    updateData((d) => { const i = d.diary.findIndex((x) => x.id === ed.id); if (i >= 0) d.diary[i] = ed; else d.diary.push({ ...ed, id: uid() }); });
    setEd(null);
  };
  const list = data.diary.filter((d) => !fc || d.classId === fc).sort((a, b) => b.date.localeCompare(a.date));
  const area = (k: keyof Diary, l: string) => (
    <div><label className="lbl">{l}</label><textarea className="field min-h-16" value={ed![k] as string} onChange={(e) => set({ [k]: e.target.value })} /></div>
  );

  return (
    <Page title="Daily diary" sub="One entry per class taught" actions={!ed && <button className="btn" onClick={() => setEd(blank(fc))}>+ New entry</button>}>
      {ed && (
        <section className="panel mb-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="lbl">Class</label><ClassSelect value={ed.classId} onChange={pickClass} /></div>
            <div><label className="lbl">Date (BS)</label><BsDate value={ed.date} onChange={(v) => set({ date: v })} /></div>
            <div><label className="lbl">Lecture hours taught</label><input type="number" className="field" value={ed.lh} onChange={(e) => set({ lh: +e.target.value })} /></div>
            <div><label className="lbl">Unit</label>
              <select className="field" value={ed.unitId} onChange={(e) => set({ unitId: e.target.value })}>
                <option value="">—</option>
                {data.units.filter((u) => u.classId === ed.classId).map((u) => <option key={u.id} value={u.id}>{u.unit}</option>)}
              </select></div>
            <div className="sm:col-span-2"><label className="lbl">Topic taught</label><input className="field" value={ed.topic} onChange={(e) => set({ topic: e.target.value })} /></div>
          </div>

          <div className="rounded-lg bg-muted/60 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1">Total students <input type="number" className="field w-20" value={ed.total} onChange={(e) => set({ total: +e.target.value })} /></label>
              <span>Present: <b className="text-primary">{Math.max(0, ed.total - ed.absent.length)}</b></span>
              <span>Absent: <b className="text-destructive">{ed.absent.length}</b></span>
            </div>
            {stu.length ? (<>
              <div className="lbl">Tap absent students</div>
              <div className="flex flex-wrap gap-1.5">
                {stu.map((s, i) => <button key={s} type="button" className={ed.absent.includes(s) ? "rounded-full bg-destructive px-2.5 py-1 text-xs text-destructive-foreground line-through" : "chip"} onClick={() => set({ absent: toggle(ed.absent, s) })}>{i + 1}. {s}</button>)}
              </div>
            </>) : (
              <label className="flex items-center gap-1 text-sm">Absent count <input type="number" className="field w-20" value={ed.absent.length} onChange={(e) => set({ absent: Array.from({ length: +e.target.value }, (_, i) => `#${i + 1}`) })} /></label>
            )}
            <div className="mt-2">{area("reasons", "Reasons for absence")}</div>
          </div>

          <div>
            <div className="lbl">Class activities (short codes for monthly report)</div>
            <div className="flex flex-wrap gap-1.5">
              {CODES.map(([c, l]) => <button key={c} type="button" className={ed.codes.includes(c) ? "chip-on" : "chip"} onClick={() => set({ codes: toggle(ed.codes, c) })}>{c} · {l}</button>)}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {area("methods", "Methods & methodology used")}
            {area("studentActs", "Students' activities")}
            {area("feedback", "Students' feedback")}
            {area("evaluation", "Evaluation done")}
            {area("remarks", "Remarks")}
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={save}>Save</button>
            <button className="btn-soft" onClick={() => setEd(null)}>Cancel</button>
            {ed.id && <button className="btn-danger ml-auto" onClick={() => { if (confirm("Delete?")) { updateData((d) => { d.diary = d.diary.filter((x) => x.id !== ed.id); }); setEd(null); } }}>Delete</button>}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="mb-3 flex items-center gap-2"><h2 className="flex-1 text-lg font-bold">Entries</h2><div className="w-64"><ClassSelect all value={fc} onChange={setFc} /></div></div>
        <ul className="divide-y divide-border">
          {list.map((d) => {
            const c = data.classes.find((x) => x.id === d.classId);
            return (
              <li key={d.id} className="cursor-pointer py-2 text-sm hover:bg-muted/50" onClick={() => setEd(structuredClone(d))}>
                <b><Dt d={d.date} /></b> · {c?.name} {c?.subject} — {d.topic || "—"}
                <div className="text-xs text-muted-foreground">Present {d.total - d.absent.length}/{d.total} · {d.lh} LH · {d.codes.join(", ")}</div>
              </li>
            );
          })}
          {!list.length && <li className="py-2 text-sm text-muted-foreground">No entries yet.</li>}
        </ul>
      </section>
    </Page>
  );
}
