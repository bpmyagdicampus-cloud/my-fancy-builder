import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, Tabs, Collection, ClassSelect, PrintHead, Signatures, PrintBtn, Dt, NeedProfile } from "@/components/app/ui";
import { updateData, uid, useTeacher, type Cls, type Data, type Lesson, type Plan, type Unit } from "@/lib/store";
import { currentYear } from "@/lib/years";
import { fmtBs } from "@/lib/bs";

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
    <Page title="Teaching plans" actions={<PrintBtn />}>
      <Tabs value={tab} onChange={setTab} items={[["annual", "Annual / unit plan"], ["plans", "Monthly & daily plans"], ["lesson", "Lesson plans"]]} />

      {tab === "annual" && (<>
        <div className="no-print mb-3 w-72"><ClassSelect value={cls} onChange={setCls} /></div>
        {c && <PrevUnits c={c} />}
        {cls && <Collection k="units" title="Units" filter={(u) => u.classId === cls} defaults={{ classId: cls }} sort={(a, b) => a.from.localeCompare(b.from)}
          fields={[
            { k: "classId", l: "Class", t: "cls" }, { k: "unit", l: "Unit (e.g. Unit 1: Introduction)" },
            { k: "topics", l: "Main topics", t: "area" }, { k: "lh", l: "Lecture hours (LH)", t: "num" },
            { k: "from", l: "From", t: "date" }, { k: "to", l: "To", t: "date" },
            { k: "methods", l: "Teaching methods" }, { k: "materials", l: "Materials" },
            { k: "assessment", l: "Assessment (quiz, class test, unit test, oral)", wide: true },
          ]}
          summary={(u) => <><b>{u.unit}</b> · {u.lh} LH<div className="text-xs text-muted-foreground"><Dt d={u.from} /> → <Dt d={u.to} /></div></>} />}
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
            <Signatures roles={[["Subject Teacher", profile.name], ["Head of Department", profile.hod], ["Campus Chief", profile.chief]]} />
          </section>
        )}
      </>)}

      {tab === "plans" && <>
        <PrevPlan />
        <Collection k="plans" title="Monthly & daily teaching plans"
          fields={[{ k: "type", l: "Plan type", t: "sel", opts: ["Daily plan", "Weekly plan", "Monthly plan", "Annual work plan"] }, { k: "classId", l: "Class", t: "cls" }, { k: "date", l: "Date / start of period", t: "date" }, { k: "status", l: "Status", t: "sel", opts: ["Planned", "Done", "Postponed"] }, { k: "title", l: "Title", wide: true }, { k: "content", l: "Plan details", t: "area" }]}
          summary={(p) => <><b>{p.type}</b> · {p.title} <span className="chip ml-1">{p.status}</span><div className="text-xs text-muted-foreground"><Dt d={p.date} /> · {cn(p.classId)}</div></>} />
        <section className="panel print-only">
          <PrintHead title="Teaching Plans" />
          <table className="rtable"><thead><tr><th>Date</th><th>Type</th><th>Class</th><th>Plan</th><th>Status</th></tr></thead>
            <tbody>{[...data.plans].sort((a, b) => a.date.localeCompare(b.date)).map((p) => <tr key={p.id}><td>{fmtBs(p.date)}</td><td>{p.type}</td><td>{cn(p.classId)}</td><td><b>{p.title}</b><div className="whitespace-pre-line">{p.content}</div></td><td>{p.status}</td></tr>)}</tbody></table>
          <Signatures roles={[["Subject Teacher", profile.name], ["Head of Department", profile.hod], ["Campus Chief", profile.chief]]} />
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

const PLAN_TYPES = ["Daily plan", "Weekly plan", "Monthly plan", "Annual work plan"];
const PREV_LABEL: Record<string, string> = { "Daily plan": "previous day's plan", "Weekly plan": "previous week's plan", "Monthly plan": "previous month's plan", "Annual work plan": "previous year's plan" };

/** The same subject's units from the most recent earlier academic year (found by subject name). */
function previousUnits(data: Data, c: Cls): { year: string; units: Unit[] } | null {
  const cur = currentYear(data)?.id;
  const subj = c.subject.trim().toLowerCase();
  if (!subj) return null;
  for (const y of [...data.years].reverse()) {
    if (y.id === cur) continue;
    const a = data.archive?.[y.id];
    if (!a?.classes || !a.units) continue;
    const ids = a.classes.filter((k) => (k.subject || "").trim().toLowerCase() === subj).map((k) => k.id);
    const units = a.units.filter((u) => ids.includes(u.classId));
    if (units.length) return { year: y.name, units };
  }
  return null;
}

function PrevUnits({ c }: { c: Cls }) {
  const { data } = useTeacher();
  const prev = previousUnits(data, c);
  const have = data.units.some((u) => u.classId === c.id);
  if (!prev) return null;
  const copy = () => {
    if (have && !confirm(`This class already has units. Add ${prev.units.length} units from ${prev.year} as well?`)) return;
    updateData((d) => {
      for (const u of prev.units) d.units.push({ ...u, id: uid(), classId: c.id, from: "", to: "" });
    });
  };
  return (
    <section className="panel no-print mb-3">
      <h3 className="mb-1 font-semibold">Last year's plan · {c.subject} ({prev.year})</h3>
      <p className="mb-2 text-xs text-muted-foreground">{prev.units.length} units found: {prev.units.slice(0, 4).map((u) => u.unit).join(" · ")}{prev.units.length > 4 ? " …" : ""}. Copy them, then edit, add or remove units and dates. The copy is saved as this year's new plan; last year's plan is not changed.</p>
      <button className="btn-soft" onClick={copy}>Copy last year's units into this plan</button>
    </section>
  );
}

function PrevPlan() {
  const { data } = useTeacher();
  const [type, setType] = useState(PLAN_TYPES[0]!);
  const [cls, setCls] = useState("");
  const list = data.plans.filter((p) => p.type === type && p.date && (!cls || p.classId === cls)).sort((a, b) => a.date.localeCompare(b.date));
  const prev: Plan | undefined = list[list.length - 1];
  const make = () => {
    if (!prev) return;
    updateData((d) => { d.plans.push({ ...prev, id: uid(), date: "", status: "Planned" }); });
  };
  return (
    <section className="panel no-print mb-3">
      <h3 className="mb-2 font-semibold">Start from the previous plan</h3>
      <div className="mb-2 grid gap-2 sm:grid-cols-2">
        <select className="field" value={type} onChange={(e) => setType(e.target.value)}>{PLAN_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <ClassSelect value={cls} onChange={setCls} />
      </div>
      {prev ? (
        <div className="rounded-md border border-border p-2 text-sm">
          <div className="text-xs text-muted-foreground">Latest {PREV_LABEL[type]} · <Dt d={prev.date} /></div>
          <b>{prev.title}</b>
          <div className="whitespace-pre-line">{prev.content}</div>
          <button className="btn mt-2" onClick={make}>Make a new plan from this</button>
          <p className="mt-1 text-xs text-muted-foreground">A copy appears in the list below with no date. Open it, change the date and details, and save. The old plan stays as it is.</p>
        </div>
      ) : <p className="text-sm text-muted-foreground">No earlier {type.toLowerCase()} found{cls ? " for this class" : ""} yet.</p>}
    </section>
  );
}
