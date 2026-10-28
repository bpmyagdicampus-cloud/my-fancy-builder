import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, Tabs, Collection, ClassSelect, PrintHead, Signatures, PrintBtn, Dt, NeedProfile } from "@/components/app/ui";
import { updateData, uid, useTeacher, type Blended, type Cls, type Data, type Lesson, type Plan, type Unit } from "@/lib/store";
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
  const [tab, setTab] = useState<"annual" | "plans" | "lesson" | "blended">("annual");
  const [cls, setCls] = useState("");
  const [lesson, setLesson] = useState<string>("");
  const [bl, setBl] = useState<string>("");
  const [guide, setGuide] = useState(false);
  const [sample, setSample] = useState(false);
  if (!profile) return <NeedProfile />;
  const c = data.classes.find((x) => x.id === cls);
  const units = data.units.filter((u) => u.classId === cls).sort((a, b) => a.from.localeCompare(b.from));
  const lp = data.lessons.find((l) => l.id === lesson);
  const bp = data.blended.find((l) => l.id === bl);
  const cn = (id: string) => { const x = data.classes.find((y) => y.id === id); return x ? `${x.name} · ${x.subject}` : "—"; };

  return (
    <Page title="Teaching plans" actions={<PrintBtn />}>
      <Tabs value={tab} onChange={setTab} items={[["annual", "Annual / unit plan"], ["plans", "Monthly & daily plans"], ["lesson", "Lesson plans"], ["blended", "Blended lesson plans"]]} />

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

      {tab === "blended" && (<>
        {guide && (
          <section className="panel no-print mb-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-lg font-bold">कुन कुरा कहिले भर्ने? · Guide</h2>
              <button className="btn-soft" onClick={() => setSample((v) => !v)}>{sample ? "Hide sample lesson plan" : "View sample lesson plan"}</button>
              <button className="btn-soft" onClick={() => setGuide(false)}>Close</button>
            </div>
            <div className="space-y-4">
              {GUIDE.map((g) => (
                <div key={g.step} className="rounded-md border border-border p-3">
                  <div className="font-semibold">{g.step}</div>
                  <div className="text-xs text-muted-foreground">{g.en}</div>
                  {g.note && <p className="mt-1 text-sm">{g.note}</p>}
                  <ul className="mt-1 space-y-1 text-sm">{g.items.map(([a, b]) => <li key={a}><b>{a}</b> — {b}</li>)}</ul>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn" onClick={() => { updateData((d) => { d.blended.push({ ...SAMPLE, id: uid(), classId: "", date: "" }); }); alert("A copy of the sample was added to your list below. Open it with Edit, choose your class and date, and change the content."); }}>Use the sample as a new plan</button>
              <span className="text-xs text-muted-foreground">A copy is added to your list; you can edit it freely. The original sample does not change.</span>
            </div>
            {sample && <div className="mt-3"><BlendedSheet l={SAMPLE} cls={undefined} over={{ level: "MBS III", subject: "Research methodology" }} /></div>}
          </section>
        )}
        <Collection k="blended" title="Blended Learning Lesson Plans" titleExtra={<button className="btn-soft !min-h-8 !py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); setGuide((v) => !v); }}>Guide</button>}
          fields={[
            { k: "classId", l: "Class / Subject", t: "cls" }, { k: "date", l: "Date", t: "date" },
            { k: "title", l: "Lesson topic" }, { k: "duration", l: "Teaching duration (e.g. 45 minutes)" },
            { k: "outcomes", l: "2. Learning outcomes: what will students know, explain or do after the lesson?", t: "area" },
            { k: "preTeacher", l: "3. Pre-class learning: Teacher's activities", t: "area" },
            { k: "preStudent", l: "3. Pre-class learning: Students' activities", t: "area" },
            { k: "preMaterials", l: "3. Pre-class learning: Learning materials (links allowed)", t: "area" },
            { k: "steps", l: "4. Face-to-face learning activities (one row per time block)", t: "rows", cols: [["time", "Time (e.g. 5 min)"], ["teacher", "Teacher's activities"], ["student", "Students' activities"], ["methods", "Teaching methods / materials"]] },
            { k: "postTeacher", l: "5. Post-class learning: Teacher's activities", t: "area" },
            { k: "postStudent", l: "5. Post-class learning: Students' activities", t: "area" },
            { k: "assignment", l: "5. Post-class learning: Assignment / practice", t: "area" },
            { k: "resources", l: "6. Learning resources and technology (digital tools, offline resources, links)", t: "area" },
            { k: "asPre", l: "7. Assessment: Pre-class", t: "area" },
            { k: "asIn", l: "7. Assessment: In-class", t: "area" },
            { k: "asPost", l: "7. Assessment: Post-class", t: "area" },
            { k: "feedback", l: "8. Feedback and improvement (feedback, remedial or additional activities)", t: "area" },
            { k: "offline", l: "9. Offline learning alternative (limited internet or devices)", t: "area" },
            { k: "refAchieved", l: "10. Reflection: Were the learning outcomes achieved?", t: "area" },
            { k: "refDifficulty", l: "10. Reflection: What difficulties did students face?", t: "area" },
            { k: "refWorked", l: "10. Reflection: What worked well?", t: "area" },
            { k: "refImprove", l: "10. Reflection: What should be improved in the next lesson?", t: "area" },
          ]}
          summary={(l) => <div className="flex items-center gap-2"><div className="flex-1"><b>{l.title}</b><div className="text-xs text-muted-foreground"><Dt d={l.date} /> · {cn(l.classId)}</div></div><button className="btn-soft" onClick={(e) => { e.stopPropagation(); setBl(l.id); }}>View / print</button></div>} />
        {bp && <BlendedSheet l={bp} cls={data.classes.find((x) => x.id === bp.classId)} />}
      </>)}
    </Page>
  );
}

function BlendedSheet({ l, cls, over }: { l: Blended; cls: Cls | undefined; over?: { level: string; subject: string } }) {
  const { profile } = useTeacher();
  const T = (v: string) => <td className="whitespace-pre-line">{v}</td>;
  const row = (a: string, v: string) => <tr key={a}><td className="w-56 font-medium">{a}</td>{T(v)}</tr>;
  return (
    <section className="panel">
      <PrintHead title="Blended Learning Lesson Plan" />
      <h3 className="mb-1 mt-2 font-semibold">1. Basic information</h3>
      <table className="rtable text-sm"><tbody>
        {row("Teacher", profile?.name ?? "")}{row("Class / Level", over?.level ?? cls?.name ?? "")}{row("Subject", over?.subject ?? (cls ? `${cls.subject}${cls.code ? ` (${cls.code})` : ""}` : ""))}
        {row("Lesson topic", l.title)}{row("Date", l.date ? fmtBs(l.date) : "")}{row("Teaching duration", l.duration)}{row("Teaching model", "Blended Learning")}
      </tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">2. Learning outcomes</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l.outcomes)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">3. Pre-class learning</h3>
      <table className="rtable text-sm"><tbody>{row("Teacher's activities", l.preTeacher)}{row("Students' activities", l.preStudent)}{row("Learning materials", l.preMaterials)}</tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">4. Face-to-face learning activities</h3>
      <table className="rtable text-sm">
        <thead><tr><th className="w-24">Time</th><th>Teacher's activities</th><th>Students' activities</th><th>Teaching methods / materials</th></tr></thead>
        <tbody>{(l.steps || []).map((s, i) => <tr key={i}>{T(s.time ?? "")}{T(s.teacher ?? "")}{T(s.student ?? "")}{T(s.methods ?? "")}</tr>)}</tbody>
      </table>
      <h3 className="mb-1 mt-4 font-semibold">5. Post-class learning</h3>
      <table className="rtable text-sm"><tbody>{row("Teacher's activities", l.postTeacher)}{row("Students' activities", l.postStudent)}{row("Assignment / practice", l.assignment)}</tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">6. Learning resources and technology</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l.resources)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">7. Assessment</h3>
      <table className="rtable text-sm"><tbody>{row("Pre-class assessment", l.asPre)}{row("In-class assessment", l.asIn)}{row("Post-class assessment", l.asPost)}</tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">8. Feedback and improvement</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l.feedback)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">9. Offline learning alternative</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l.offline)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">10. Teacher reflection</h3>
      <table className="rtable text-sm"><tbody>
        {row("Were the learning outcomes achieved?", l.refAchieved)}{row("What difficulties did students face?", l.refDifficulty)}{row("What worked well?", l.refWorked)}{row("What should be improved in the next lesson?", l.refImprove)}
      </tbody></table>
      <Signatures roles={[["Subject Teacher", profile?.name], ["Head of Department", profile?.hod]]} />
    </section>
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

/** Who fills what, and when. */
const GUIDE: { step: string; en: string; note?: string; items: [string, string][] }[] = [
  { step: "चरण १: कक्षा सुरु हुनुभन्दा पहिले", en: "Planning Stage", note: "शिक्षकले पाठ योजना तयार गर्दा भर्ने।", items: [
    ["१. Basic Information", "कक्षा, विषय, पाठ, मिति र अवधि।"],
    ["२. Learning Outcomes", "विद्यार्थीले के सिक्ने वा गर्न सक्नेछन्?"],
    ["३. Pre-Class Learning", "कक्षाअघि पढ्ने सामग्री र गतिविधि।"],
    ["४. Face-to-Face Learning Activities", "प्रत्यक्ष कक्षाको समय विभाजन र गतिविधि।"],
    ["५. Post-Class Learning", "कक्षापछि गर्ने अभ्यास वा गृहकार्य।"],
    ["६. Learning Resources and Technology", "पुस्तक, नोट, भिडियो, मोबाइल वा अन्य सामग्री।"],
    ["७. Assessment", "सिकाइ जाँच्ने प्रश्न, अभ्यास र मूल्याङ्कन विधि।"],
    ["८. Feedback and Improvement", "सम्भावित कठिनाइअनुसार दिने प्रतिक्रिया र सुधारको योजना।"],
    ["९. Offline Learning Alternative", "इन्टरनेट वा उपकरण नभएका विद्यार्थीका लागि वैकल्पिक व्यवस्था।"],
  ] },
  { step: "चरण २: कक्षा सञ्चालन गर्दा", en: "During Class", items: [
    ["४. Face-to-Face Learning Activities", "मा लेखिएको योजनाअनुसार कक्षा सञ्चालन गर्ने। आवश्यक परे वास्तविक गतिविधि वा समय परिवर्तन भएमा अद्यावधिक गर्ने।"],
    ["७. Assessment", "अन्तर्गत विद्यार्थीको उत्तर, सहभागिता र सिकाइको अवस्था जाँच्ने।"],
  ] },
  { step: "चरण ३: कक्षा सम्पन्न भएपछि", en: "Reflection Stage", items: [
    ["७. Assessment", "वास्तविक मूल्याङ्कन नतिजा अभिलेख गर्ने।"],
    ["८. Feedback and Improvement", "विद्यार्थीलाई दिएको प्रतिक्रिया तथा आवश्यक सुधार अभिलेख गर्ने।"],
    ["१०. Teacher Reflection", "सिकाइ उपलब्धि, देखिएका समस्या र अर्को कक्षामा गर्नुपर्ने सुधार लेख्ने।"],
    ["५. Post-Class Learning", "गृहकार्य वा अभ्यास पूरा भएपछि आवश्यक भएमा प्रगति अद्यावधिक गर्ने।"],
  ] },
];

/** Sample lesson plan (Research Methodology, MBS III) taken from the PDF sample. */
const SAMPLE: Blended = {
  id: "sample", classId: "", date: "", title: "Concept and Meaning of Research", duration: "55 mins. 1 Lecture Hour",
  outcomes: "By the end of the lesson, students will be able to:\n1. Explain the meaning of research in their own words.\n2. Identify the basic characteristics of a research activity.\n3. Distinguish systematic research from ordinary observation or guesswork.\n4. Provide one example of a research problem related to management or business.",
  preTeacher: "The teacher will provide a one-page note or a short video",
  preStudent: "Before attending class, students will:\n• Think about one problem faced by a business, bank, cooperative or educational institution.\n• Consider what information would be needed to understand that problem.\n• Read a short introductory note on the meaning of research, provided by the teacher.",
  preMaterials: "A one-page printed note or a short digital reading.",
  steps: [
    { time: "0–5 min", teacher: "Introduction: Ask, “Why might sales decline even when a business has many customers?” Connect students’ responses with the need for research.", student: "Share initial ideas and experiences.", methods: "short videos, ppt" },
    { time: "5–15 min", teacher: "Concept and meaning: Explain research as a systematic process of inquiry used to investigate questions and develop evidence-based understanding. Clarify the difference between casual guessing and systematic investigation.", student: "Listen, take notes and ask questions.", methods: "lecture" },
    { time: "15–25 min", teacher: "Management example: Discuss a business experiencing declining sales. Explain how a researcher might examine customer preferences, prices, product quality and competitors.", student: "Identify what information should be collected and why.", methods: "discussion" },
    { time: "25–35 min", teacher: "Pair activity: Students identify one management-related problem and write one research question about it.", student: "Work in pairs and prepare a research question.", methods: "Group work" },
    { time: "35–43 min", teacher: "Sharing and clarification: Invite two or three pairs to present their questions. Explain how a broad problem can be investigated systematically.", student: "Present ideas and provide peer feedback.", methods: "presentation" },
    { time: "43–48 min", teacher: "Quick assessment: Ask short oral or written questions about the meaning and purpose of research.", student: "Answer individually.", methods: "assessment," },
    { time: "48–50 min", teacher: "Conclusion: Summarize the lesson and introduce the next topic, Types of Research.", student: "State one key learning point.", methods: "lecture" },
    { time: "50-55 min", teacher: "Assignment given, homework and assignment", student: "", methods: "Assignment problems" },
  ],
  postTeacher: "• Bring their example to the next class for discussion",
  postStudent: "• Write a short explanation of research in their own words.\n• Identify one researchable problem from a business or management setting.\n• Frame one research question related to that problem.",
  assignment: "",
  resources: "• Whiteboard and markers\n• Teacher-prepared lecture notes\n• Printed example of a business problem\n• Projector or presentation slides, if available\n• Mobile phone or internet-based learning materials, where accessible\nTechnology alternative: The lesson can be conducted fully offline using printed notes, board work and pair discussion.",
  asPre: "questioning",
  asIn: "Formative assessment during the lesson:\n1. What is meant by research?\n2. How is systematic research different from guesswork?\n3. A shop's sales have declined. Write one research question that could help the owner understand the problem.\n4. Why is reliable information important for managerial decisions?",
  asPost: "Students' oral responses, written answers and pair-activity outputs.",
  feedback: "Planned feedback approach:\n• Provide immediate verbal feedback on students' answers.\n• Correct misunderstandings about research and ordinary observation.\n• Give examples if students struggle to frame research questions.\n• Begin the next class by revisiting any concept that remains unclear.\nAfter-class record: The teacher will record common difficulties and decide whether additional explanation or a short remedial activity is needed",
  offline: "For students with limited internet access:\n• Provide printed notes before or during class.\n• Explain the example using the whiteboard.\n• Conduct the pair activity without digital devices.\n• Allow homework to be submitted in a notebook.\n• Share any additional learning materials in printed form or through an accessible campus notice board.",
  refAchieved: "To be completed after the class:\n• Were the planned learning outcomes achieved?\n• Could students explain the meaning of research in their own words?\n• Were students able to frame a relevant research question?",
  refDifficulty: "• What difficulties did students experience?",
  refWorked: "Which activity generated the most participation?",
  refImprove: "• What should be improved in the next lesson?",
};
