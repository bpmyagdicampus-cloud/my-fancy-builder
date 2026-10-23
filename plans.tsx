import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, Tabs, Collection, ClassSelect, PrintHead, Signatures, PrintBtn, Dt, NeedProfile } from "@/components/app/ui";
import { updateData, uid, useTeacher, type Lesson, type Plan, type Unit } from "@/lib/store";
import { fmtBs, todayBs } from "@/lib/bs";
import { ExportTools } from "@/components/app/ExportTools";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [
    { title: "Teaching Plans — Shikshak Diary" },
    { name: "description", content: "Annual unit-wise plan, monthly and daily teaching plans, and period-wise lesson plans." },
    { property: "og:title", content: "Teaching Plans — Shikshak Diary" },
    { property: "og:description", content: "Annual, monthly, daily and lesson plans with printable approval sheets." },
  ] }),
  component: Plans,
});

function Plans() {
  const { profile, data } = useTeacher();
  const [tab, setTab] = useState<"annual" | "plans" | "lesson">("annual");
  const [cls, setCls] = useState("");
  const [lesson, setLesson] = useState<string>("");
  if (!profile) return <NeedProfile />;
  const c = data.classes.find((x) => x.id === cls);
  const units = data.units.filter((u) => u.classId === cls).sort((a, b) => a.from.localeCompare(b.from));
  const lp = data.lessons.find((l) => l.id === lesson);
  const cn = (id: string) => { const x = data.classes.find((y) => y.id === id); return x ? `${x.name} · ${x.subject}` : "—"; };

  return (
    <Page title="Teaching plans" actions={<><ExportTools baseName="teaching-plans" /><PrintBtn /></>}>
      <Tabs value={tab} onChange={setTab} items={[["annual", "Annual / unit plan"], ["plans", "Monthly & daily plans"], ["lesson", "Lesson plans"]]} />

      {tab === "annual" && (<>
        <div className="no-print mb-3 w-72"><ClassSelect value={cls} onChange={setCls} /></div>
        {cls && <><PreviousAnnualCopy classId={cls} /><Collection k="units" title="Units" filter={(u) => u.classId === cls} defaults={{ classId: cls }} sort={(a, b) => a.from.localeCompare(b.from)}
          fields={[
            { k: "classId", l: "Class", t: "cls" }, { k: "unit", l: "Unit (e.g. Unit 1: Introduction)" },
            { k: "topics", l: "Main topics", t: "area" }, { k: "lh", l: "Lecture hours (LH)", t: "num" },
            { k: "from", l: "From", t: "date" }, { k: "to", l: "To", t: "date" },
            { k: "methods", l: "Teaching methods" }, { k: "materials", l: "Materials" },
            { k: "assessment", l: "Assessment (quiz, class test, unit test, oral)", wide: true },
          ]}
          summary={(u) => <><b>{u.unit}</b> · {u.lh} LH<div className="text-xs text-muted-foreground"><Dt d={u.from} /> → <Dt d={u.to} /></div></>} /></>}
        {c && (
          <section className="panel">
            <PrintHead title={<>Annual Teaching Plan — {c.name}, {c.subject} {c.code} ({c.year})</>} />
            <div className="mb-2 text-sm">Teacher: <b>{profile.name}</b>, {profile.designation} · Total LH: {c.totalLh} · Planned LH: {units.reduce((a, u) => a + (u.lh || 0), 0)}</div>
            <table className="rtable">
              <thead><tr><th>S.N.</th><th>Unit</th><th>Main topics</th><th>LH</th><th>Duration</th><th>Methods & materials</th><th>Assessment</th></tr></thead>
              <tbody>{units.map((u, i) => (
                <tr key={u.id}><td>{i + 1}</td><td>{u.unit}</td><td className="whitespace-pre-line">{u.topics}</td><td>{u.lh}</td><td>{fmtBs(u.from)} – {fmtBs(u.to)}</td><td>{u.methods}{u.materials && <><br />{u.materials}</>}</td><td>{u.assessment}</td></tr>
              ))}</tbody>
            </table>
            {data.cal.length > 0 && (<>
              <h3 className="mb-1 mt-4 font-semibold">Academic calendar</h3>
              <table className="rtable"><thead><tr><th>Activity</th><th>Note</th><th>From</th><th>To</th></tr></thead>
                <tbody>{[...data.cal].sort((a, b) => a.from.localeCompare(b.from)).map((e) => <tr key={e.id}><td>{e.type}</td><td>{e.title}</td><td>{fmtBs(e.from)}</td><td>{e.to ? fmtBs(e.to) : ""}</td></tr>)}</tbody></table>
            </>)}
            <Signatures roles={[["Subject Teacher", profile.name], ["Head of Department", data.settings.institution?.departmentHead || profile.hod], ["Campus Chief", data.settings.institution?.campusChief || profile.chief]]} />
          </section>
        )}
      </>)}

      {tab === "plans" && <>
        <div className="no-print mb-3 w-72"><label className="lbl">Class / Subject</label><ClassSelect value={cls} onChange={setCls} /></div>
        <PreviousPlanCopy classId={cls} />
        <Collection k="plans" title="Monthly & daily teaching plans"
          fields={[{ k: "type", l: "Plan type", t: "sel", opts: ["Daily plan", "Weekly plan", "Monthly plan", "Annual work plan"] }, { k: "classId", l: "Class", t: "cls" }, { k: "date", l: "Date / start of period", t: "date" }, { k: "status", l: "Status", t: "sel", opts: ["Planned", "Done", "Postponed"] }, { k: "title", l: "Title", wide: true }, { k: "content", l: "Plan details", t: "area" }]}
          summary={(p) => <><b>{p.type}</b> · {p.title} <span className="chip ml-1">{p.status}</span><div className="text-xs text-muted-foreground"><Dt d={p.date} /> · {cn(p.classId)}</div></>} />
        <section className="panel print-only">
          <PrintHead title="Teaching Plans" />
          <table className="rtable"><thead><tr><th>Date</th><th>Type</th><th>Class</th><th>Plan</th><th>Status</th></tr></thead>
            <tbody>{[...data.plans].sort((a, b) => a.date.localeCompare(b.date)).map((p) => <tr key={p.id}><td>{fmtBs(p.date)}</td><td>{p.type}</td><td>{cn(p.classId)}</td><td><b>{p.title}</b><div className="whitespace-pre-line">{p.content}</div></td><td>{p.status}</td></tr>)}</tbody></table>
          <Signatures roles={[["Subject Teacher", profile.name], ["Head of Department", data.settings.institution?.departmentHead || profile.hod], ["Campus Chief", data.settings.institution?.campusChief || profile.chief]]} />
        </section>
      </>}

      {tab === "lesson" && (<>
        <Collection k="lessons" title="Period-wise lesson plans"
          fields={[{ k: "classId", l: "Class", t: "cls" }, { k: "date", l: "Date", t: "date" }, { k: "from", l: "Start time", t: "time" }, { k: "to", l: "End time", t: "time" }, { k: "title", l: "Lesson title" }, { k: "level", l: "Grade level" }, { k: "objectives", l: "Learning objectives (Bloom's taxonomy, lower → higher)", t: "area" }, { k: "steps", l: "Teaching steps", t: "rows", cols: [["step", "Step & time (e.g. Motivation – 5 min)"], ["activity", "Activity"], ["theory", "Learning theory / model"]] }, { k: "resources", l: "Resources", t: "area" }, { k: "assessment", l: "Assessment & feedback", t: "area" }]}
          summary={(l) => <div className="flex items-center gap-2"><div className="flex-1"><b>{l.title}</b><div className="text-xs text-muted-foreground"><Dt d={l.date} /> · {cn(l.classId)}</div></div><button className="btn-soft" onClick={(e) => { e.stopPropagation(); setLesson(l.id); }}>View / print</button></div>} />
        {lp && <LessonSheet l={lp} cls={cn(lp.classId)} />}
      </>)}
    </Page>
  );
}

function sameSubject(a: { subject?: string; code?: string; name?: string }, b: { subject?: string; code?: string; name?: string }) {
  const sameSub = (a.subject ?? "").trim().toLowerCase() === (b.subject ?? "").trim().toLowerCase();
  const codesComparable = !a.code || !b.code || a.code.trim().toLowerCase() === b.code.trim().toLowerCase();
  return sameSub && codesComparable;
}

function PreviousAnnualCopy({ classId }: { classId: string }) {
  const { data } = useTeacher();
  const target = data.classes.find((c) => c.id === classId);
  const currentIndex = data.years.findIndex((y) => y.id === data.settings.yearId);
  const oldYears = (currentIndex >= 0 ? data.years.slice(0, currentIndex) : data.years.slice(0, -1)).slice().reverse();
  let source: { year: string; cls: any; units: Unit[] } | null = null;
  if (target) for (const year of oldYears) {
    const snap = data.archive[year.id];
    if (!snap?.classes || !snap.units) continue;
    const oldClass = snap.classes.find((c: any) => sameSubject(c, target));
    if (!oldClass) continue;
    const units = (snap.units as Unit[]).filter((u) => u.classId === oldClass.id);
    if (units.length) { source = { year: year.name, cls: oldClass, units }; break; }
  }
  if (!target) return null;
  const copy = () => {
    if (!source || !confirm(`Copy ${source.units.length} annual-plan units from ${source.year} (${source.cls.name}) into ${target.name}? Existing plans will remain unchanged.`)) return;
    updateData((d) => { d.units.push(...source!.units.map((u) => ({ ...u, id: uid(), classId: target.id }))); });
    alert("Previous annual plan copied as new records. Review dates and edit the copied units for this year.");
  };
  return <section className="panel mb-3 border-dashed border-primary/40"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><h3 className="font-bold">Previous annual plan · अघिल्लो वर्षको योजना</h3>{source ? <p className="mt-1 text-sm text-muted-foreground">Found {source.units.length} units for {source.cls.name} · {source.cls.subject} in academic year {source.year}. You can copy these as new editable units.</p> : <p className="mt-1 text-sm text-muted-foreground">No matching plan was found in saved previous-year records for this subject.</p>}</div><button className="btn-soft" disabled={!source} onClick={copy}>Copy as new plan</button></div></section>;
}

function PreviousPlanCopy({ classId }: { classId: string }) {
  const { data } = useTeacher();
  const [kind, setKind] = useState<"Daily plan" | "Monthly plan">("Daily plan");
  const [targetDate, setTargetDate] = useState(todayBs());
  const target = data.classes.find((c) => c.id === classId);
  const candidates: { plan: Plan; sourceClassName: string; year: string }[] = [];
  if (target) {
    for (const plan of data.plans) if (plan.classId === target.id && plan.type === kind && (kind === "Daily plan" ? plan.date < targetDate : plan.date.slice(0, 7) < targetDate.slice(0, 7))) candidates.push({ plan, sourceClassName: target.name, year: "current year" });
    for (const year of data.years) {
      const snap = data.archive[year.id];
      if (!snap?.classes || !snap.plans) continue;
      const oldClass = (snap.classes as any[]).find((c) => sameSubject(c, target));
      if (!oldClass) continue;
      for (const plan of snap.plans as Plan[]) if (plan.classId === oldClass.id && plan.type === kind && (kind === "Daily plan" ? plan.date < targetDate : plan.date.slice(0, 7) < targetDate.slice(0, 7))) candidates.push({ plan, sourceClassName: oldClass.name, year: year.name });
    }
  }
  candidates.sort((a, b) => b.plan.date.localeCompare(a.plan.date));
  const source = candidates[0];
  const copy = () => {
    if (!source || !target) return;
    if (!confirm(`Copy the ${source.plan.type.toLowerCase()} “${source.plan.title}” from ${source.year} as a NEW plan for ${target.name} on ${targetDate}? The original will not be changed.`)) return;
    updateData((d) => { d.plans.push({ ...source.plan, id: uid(), classId: target.id, date: targetDate, status: "Planned", title: `${source!.plan.title} (copied)` }); });
    alert("Copied as a new plan. Open the new record and edit it for the current date/period.");
  };
  return <section className="panel mb-3 border-dashed border-primary/40"><div className="mb-3 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><h3 className="font-bold">Reuse a previous plan · पुरानो योजना पुनःप्रयोग</h3><p className="text-xs text-muted-foreground">The app finds the most recent matching plan for this subject. A copy gets a new ID and never overwrites the original.</p></div><label><span className="lbl">Plan type</span><select className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option>Daily plan</option><option>Monthly plan</option></select></label><label><span className="lbl">New date / period</span><input type="text" className="field !w-36" placeholder="2083-07-01" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label></div>{!classId ? <p className="text-sm text-muted-foreground">Select a class above to find the previous plan.</p> : source ? <div className="rounded-xl bg-muted/40 p-3"><div className="flex flex-wrap items-start gap-3"><div className="flex-1"><p className="text-xs text-muted-foreground">Previous {kind.toLowerCase()} · {source.year} · {source.sourceClassName} · {fmtBs(source.plan.date)}</p><p className="font-semibold">{source.plan.title || "Untitled plan"}</p><p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{source.plan.content}</p></div><button className="btn" onClick={copy}>Copy as new plan</button></div></div> : <p className="text-sm text-muted-foreground">No matching earlier {kind.toLowerCase()} was found before {targetDate}.</p>}</section>;
}

function LessonSheet({ l, cls }: { l: Lesson; cls: string }) {
  const { profile } = useTeacher();
  return (
    <section className="panel">
      <PrintHead title="Lesson Plan" />
      <table className="rtable text-sm">
        <thead><tr><th className="w-32">Section</th><th>Details</th><th className="w-40">Remarks</th></tr></thead>
        <tbody>
          <tr><td>Lesson title</td><td>{l.title}</td><td></td></tr>
          <tr><td>Grade level</td><td>{l.level || cls}</td><td></td></tr>
          <tr><td>Date / Duration</td><td>{fmtBs(l.date)} · {l.from} to {l.to}</td><td></td></tr>
          <tr><td>Learning objectives</td><td className="whitespace-pre-line">{l.objectives}</td><td>Bloom's taxonomy (lower to higher)</td></tr>
          {(l.steps || []).map((s, i) => <tr key={i}><td>{i === 0 ? "Teaching steps" : ""}</td><td><b>{s.step}</b><div className="whitespace-pre-line">{s.activity}</div></td><td>{s.theory}</td></tr>)}
          <tr><td>Assessment & feedback</td><td className="whitespace-pre-line">{l.assessment}</td><td></td></tr>
          <tr><td>Resources</td><td className="whitespace-pre-line">{l.resources}</td><td></td></tr>
        </tbody>
      </table>
      <Signatures roles={[["Subject Teacher", profile?.name], ["Head of Department", profile?.hod]]} />
    </section>
  );
}
