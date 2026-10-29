import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page, Tabs, Collection, ClassSelect, PrintHead, Signatures, PrintBtn, Dt, NeedProfile } from "@/components/app/ui";
import { updateData, uid, useTeacher, type Blended, type Cls, type Data, type Lesson, type Plan, type Unit } from "@/lib/store";
import { currentYear } from "@/lib/years";
import { fmtBs } from "@/lib/bs";
import * as D from "@/lib/dm";

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
  const yr = currentYear(data);
  const totalPlannedLh = units.reduce((a, u) => a + (u.lh || 0), 0);

  return (
    <Page title="Teaching plans" actions={<PrintBtn />}>
      <Tabs value={tab} onChange={setTab} items={[["annual", "Annual / unit plan"], ["plans", "Monthly & daily plans"], ["lesson", "Lesson plans"], ["blended", "Blended lesson plans"]]} />

      {tab === "annual" && (<>
        <div className="no-print mb-3 w-72"><ClassSelect value={cls} onChange={setCls} /></div>
        {c && <ClassAcademicCalendarBanner c={c} yearName={yr?.name || c.year || ""} plannedLh={totalPlannedLh} />}
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
            <div className="mb-2 text-sm">Teacher: <b>{profile.name}</b>, {profile.designation} · Total LH: {c.totalLh} · Planned LH: {totalPlannedLh}</div>
            <table className="rtable">
              <thead><tr><th>S.N.</th><th>Unit</th><th>Main topics</th><th>LH</th><th>Duration</th><th>Methods & materials</th><th>Assessment</th></tr></thead>
              <tbody>{units.map((u, i) => (
                <tr key={u.id}><td>{i + 1}</td><td>{u.unit}</td><td className="whitespace-pre-line">{u.topics}</td><td>{u.lh}</td><td>{fmtBs(u.from)} – {fmtBs(u.to)}</td><td>{u.methods}{u.materials && <><br />{u.materials}</>}</td><td>{u.assessment}</td></tr>
              ))}</tbody>
            </table>
            {data.cal.length > 0 && (<>
              <h3 className="mb-1 mt-4 font-semibold">Academic calendar · कार्यतालिका</h3>
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
                  <div className="mt-1 text-sm text-muted-foreground">{g.body}</div>
                  {g.eg && <div className="mt-2 text-xs italic text-muted-foreground">उदा: {g.eg}</div>}
                </div>
              ))}
            </div>
          </section>
        )}
        {sample && <SampleModal onClose={() => setSample(false)} />}
        <Collection k="blended" title="Blended Learning Lesson Plans" titleExtra={<button className="btn-soft !min-h-8 !py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); setGuide((v) => !v); }}>Guide</button>}
          fields={[
            { k: "classId", l: "Class", t: "cls" }, { k: "date", l: "Date", t: "date" }, { k: "duration", l: "Duration (min)", t: "num" },
            { k: "title", l: "Lesson title", wide: true }, { k: "outcomes", l: "Learning outcomes (सिक्ने उपलब्धिहरू)", t: "area" },
            { k: "preTeacher", l: "१. कक्षा पूर्व — शिक्षकको काम (Pre-class: Teacher)", t: "area" },
            { k: "preStudent", l: "१. कक्षा पूर्व — विद्यार्थीको काम (Pre-class: Student)", t: "area" },
            { k: "preMaterials", l: "१. कक्षा पूर्व — स्रोत / सामग्री (Pre-class materials: Video, text)", t: "area" },
            { k: "steps", l: "२. कक्षा भित्र — मुख्य चरणहरू (In-class steps)", t: "rows", cols: [["time", "Time"], ["activity", "Teacher & student activity"], ["tech", "Online / digital tools"], ["eval", "Evaluation"]] },
            { k: "postTeacher", l: "३. कक्षा पश्चात — शिक्षकको काम (Post-class: Teacher)", t: "area" },
            { k: "postStudent", l: "३. कक्षा पश्चात — विद्यार्थीको काम (Post-class: Student)", t: "area" },
            { k: "assignment", l: "३. कक्षा पश्चात — गृहकार्य / परियोजना (Assignment / Project)", t: "area" },
            { k: "resources", l: "स्रोतहरू / लिङ्क (Resources & links)", t: "area" },
            { k: "asPre", l: "मूल्याङ्कन — कक्षा पूर्व (Assessment: Pre-class)", t: "area" },
            { k: "asIn", l: "मूल्याङ्कन — कक्षा भित्र (Assessment: In-class)", t: "area" },
            { k: "asPost", l: "मूल्याङ्कन — कक्षा पश्चात (Assessment: Post-class)", t: "area" },
            { k: "feedback", l: "पृष्ठपोषण योजना (Feedback plan)", t: "area" },
            { k: "offline", l: "अफलाइन / वैकल्पिक व्यवस्था (Offline support)", t: "area" },
            { k: "refAchieved", l: "आत्ममूल्याङ्कन — उपलब्धि कति भयो? (Self-reflection: Outcomes achieved)", t: "area" },
            { k: "refDifficulty", l: "आत्ममूल्याङ्कन — समस्या कहाँ आयो? (Difficulties faced)", t: "area" },
            { k: "refWorked", l: "आत्ममूल्याङ्कन — कुन विधि सफल भयो? (What worked well)", t: "area" },
            { k: "refImprove", l: "आत्ममूल्याङ्कन — अर्को पटक के सुधार गर्ने? (Next improvement)", t: "area" },
          ]}
          summary={(l) => <div className="flex items-center gap-2"><div className="flex-1"><b>{l.title}</b><div className="text-xs text-muted-foreground"><Dt d={l.date} /> · {l.duration} min · {cn(l.classId)}</div></div><button className="btn-soft" onClick={(e) => { e.stopPropagation(); setBl(l.id); }}>View / print</button></div>} />
        {bp && <BlendedSheet b={bp} cls={cn(bp.classId)} />}
      </>)}
    </Page>
  );
}

/**
 * Requirement: Class Academic Calendar Banner shown inside Annual Unit Plan
 * Shows Net Teaching Days, working days, exam dates, vacation, and compares Planned LH vs Teaching Days!
 */
function ClassAcademicCalendarBanner({ c, yearName, plannedLh }: { c: Cls; yearName: string; plannedLh: number }) {
  const [cal, setCal] = useState<D.ClassAcademicCalendar | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Find calendar for this class
    D.loadClassCalendar(c.deptId || "", yearName, c.centralId || c.id).then((res) => {
      if (!active) return;
      if (res.ok && res.data) {
        setCal(res.data);
      } else {
        // Try searching all calendars in the department matching class name
        D.loadAllClassCalendars(c.deptId || "", yearName).then((list) => {
          if (!active) return;
          const matched = list.find(
            (x) =>
              (c.centralId && x.class_id === c.centralId) ||
              x.class_name.trim().toLowerCase() === c.name.trim().toLowerCase()
          );
          setCal(matched || null);
          setLoading(false);
        });
        return;
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [c.id, c.centralId, c.deptId, c.name, yearName]);

  if (loading) return null;
  if (!cal) {
    return (
      <div className="no-print mb-4 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>
          💡 यो कक्षा (<b>{c.name}</b>) को विभागीय शैक्षिक कार्यतालिका अझै तयार भएको छैन। विभागका प्रमुखले <b>Department → Academic Calendar</b> मा गएर बनाउन सक्नुहुन्छ।
        </span>
        <Link to="/department" className="underline font-semibold">
          Department खोल्नुहोस् →
        </Link>
      </div>
    );
  }

  // Extract key milestone dates and net teaching days
  const teachingDaysRow = cal.particulars.find((p) => p.isTeachingDays);
  const workingDaysRow = cal.particulars.find((p) => p.isTotalDays);
  const startRow = cal.particulars.find((p) => /start|सुरु/i.test(p.title));
  const exam1Row = cal.particulars.find((p) => /1st|first|प्रथम/i.test(p.title) && /exam|परीक्षा/i.test(p.title));
  const exam2Row = cal.particulars.find((p) => /2nd|second|दोस्रो/i.test(p.title) && /exam|परीक्षा/i.test(p.title));
  const exam3Row = cal.particulars.find((p) => /3rd|third|तेस्रो/i.test(p.title) && /exam|परीक्षा/i.test(p.title));
  const vacRow = cal.particulars.find((p) => /vacation|holiday|बिदा/i.test(p.title));
  const boardRow = cal.particulars.find((p) => /board|final|बोर्ड/i.test(p.title));

  const netTeachingDays = Number(teachingDaysRow?.remarks) || 0;
  const totalWorkingDays = Number(workingDaysRow?.remarks) || 0;

  const extractMilestoneText = (row?: D.CalendarParticularRow) => {
    if (!row) return "—";
    if (row.type === "span" && row.spanText) return row.spanText;
    const entries = Object.entries(row.values).filter(([, v]) => Boolean(v?.trim()));
    if (!entries.length) return "—";
    return entries.map(([m, v]) => `${D.BS_MONTH_INFO.find((x) => String(x.bsMonth) === m)?.ne || m}: ${v}`).join(", ");
  };

  return (
    <div className="no-print mb-4 rounded-xl border border-primary/40 bg-secondary/30 p-3.5 text-xs shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-primary">
            📅 {c.name} शैक्षिक कार्यतालिका · Academic Calendar ({cal.academic_year})
          </span>
          <span className={cal.status === "approved" ? "chip-on" : "chip"}>
            {cal.status === "approved" ? "Approved · स्वीकृत" : "Draft / In Review"}
          </span>
        </div>
        <button
          type="button"
          className="btn-soft !py-1 !px-2.5 text-xs font-semibold"
          onClick={() => setModalOpen(true)}
        >
          View Full Calendar · पूर्ण कार्यतालिका हेर्नुहोस्
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-muted-foreground text-[11px]">Net Teaching Days · पढाउने दिन</div>
          <div className="text-base font-bold text-primary">{netTeachingDays || "—"} days</div>
          <div className="text-[10px] text-muted-foreground">
            Planned Units: <b>{plannedLh} LH</b> / {c.totalLh} LH
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-muted-foreground text-[11px]">Total Working Days · कार्यदिन</div>
          <div className="text-base font-bold">{totalWorkingDays || "—"} days</div>
          <div className="text-[10px] text-muted-foreground truncate">
            Classes Start: {extractMilestoneText(startRow)}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-muted-foreground text-[11px]">Term Exams · त्रैमासिक परीक्षा</div>
          <div className="font-bold truncate">1st: {extractMilestoneText(exam1Row)}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            2nd: {extractMilestoneText(exam2Row)}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-muted-foreground text-[11px]">Vacation & Board Exam</div>
          <div className="font-bold truncate">बिदा: {extractMilestoneText(vacRow)}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            Board: {extractMilestoneText(boardRow)}
          </div>
        </div>
      </div>

      {/* Full Matrix Calendar Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-3 backdrop-blur-sm" role="dialog">
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-base text-primary">
                {cal.class_name} — Academic Calendar ({cal.academic_year})
              </h3>
              <button
                type="button"
                className="btn-soft !py-1 !px-2 text-xs"
                onClick={() => setModalOpen(false)}
              >
                ✕ Close · बन्द गर्नुहोस्
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="rtable w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Particulars \ Months</th>
                    {cal.months.map((m) => (
                      <th key={m.bsMonth} className="p-2 text-center">
                        <div>{m.nameEn}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{m.nameNe}</div>
                      </th>
                    ))}
                    <th className="p-2 text-center">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {cal.particulars.map((row) => {
                    const isHighlight = row.isTotalDays || row.isTeachingDays;
                    return (
                      <tr key={row.id} className={isHighlight ? "bg-muted/40 font-semibold" : ""}>
                        <td className="p-2 align-middle">{row.title}</td>
                        {row.type === "span" ? (
                          <td colSpan={cal.months.length} className="p-2 text-center italic text-muted-foreground">
                            {row.spanText || "—"}
                          </td>
                        ) : (
                          cal.months.map((m) => (
                            <td key={m.bsMonth} className="p-1.5 text-center align-middle">
                              {row.values[String(m.bsMonth)] ?? row.values[m.nameEn] ?? "—"}
                            </td>
                          ))
                        )}
                        <td className="p-2 text-center align-middle font-bold">{row.remarks || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
              <span>Prepared by: {cal.prepared_name || "Head of Department"}</span>
              <span>Approved by: {cal.approved_name || "Campus Chief"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrevUnits({ c }: { c: Cls }) {
  const { data } = useTeacher();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const curr = data.units.filter((u) => u.classId === c.id);
  const oldYear = Object.entries(data.archive ?? {})
    .reverse()
    .find(([, a]) => ((a as any).classes as Cls[] | undefined)?.some((x) => x.name === c.name && x.subject === c.subject));
  if (!oldYear || curr.length > 0) return null;
  const [yr, arch] = oldYear;
  const oldClass = ((arch as any).classes as Cls[]).find((x) => x.name === c.name && x.subject === c.subject)!;
  const oldUnits = (((arch as any).units ?? []) as Unit[]).filter((u) => u.classId === oldClass.id);
  if (!oldUnits.length) return null;

  const copy = () => {
    setBusy(true);
    setMsg("");
    updateData((d) => {
      for (const u of oldUnits) {
        d.units.push({ ...u, id: uid(), classId: c.id, from: "", to: "" });
      }
    });
    setMsg(`Copied ${oldUnits.length} units from ${yr}. Fill in the new dates below.`);
    setBusy(false);
  };

  return (
    <section className="panel no-print mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">Copy units from last year · अघिल्लो वर्षका एकाइहरू कपी गर्ने</div>
          <div className="text-xs text-muted-foreground">{yr} has {oldUnits.length} syllabus units for {c.name} · {c.subject}. Start with those and adjust the dates.</div>
        </div>
        <button className="btn-soft" disabled={busy} onClick={copy}>{busy ? "Copying…" : `Copy ${oldUnits.length} units from ${yr}`}</button>
      </div>
      {msg && <p className="mt-2 text-xs text-primary font-medium">{msg}</p>}
    </section>
  );
}

function PrevPlan() {
  const { data } = useTeacher();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [choice, setChoice] = useState("");
  const current = data.plans;
  const archives = Object.entries(data.archive ?? {}).reverse();
  const sources: { yr: string; p: Plan }[] = [];
  for (const [yr, a] of archives) {
    for (const p of ((a as any).plans ?? []) as Plan[]) {
      sources.push({ yr, p });
    }
  }
  if (!sources.length) return null;

  const copyOne = () => {
    if (!choice) return;
    const hit = sources.find((s) => `${s.yr}:${s.p.id}` === choice);
    if (!hit) return;
    setBusy(true);
    setMsg("");
    const matchedClass = data.classes.find((c) => c.name === cnOf(hit.p.classId, hit.yr));
    updateData((d) => {
      d.plans.push({
        ...hit.p,
        id: uid(),
        classId: matchedClass?.id ?? d.classes[0]?.id ?? "",
        date: new Date().toISOString().slice(0, 10),
        status: "Planned",
      });
    });
    setMsg(`Copied "${hit.p.title}" from ${hit.yr} as a new plan. Edit the date and details below.`);
    setChoice("");
    setBusy(false);
  };

  function cnOf(classId: string, yr: string): string {
    const a = (data.archive ?? {})[yr] as any;
    const c = (a?.classes as Cls[] | undefined)?.find((x) => x.id === classId);
    return c?.name ?? "";
  }

  return (
    <section className="panel no-print mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">Start from a previous plan · पुरानो योजनाबाट सुरु गर्नुहोस्</div>
          <div className="text-xs text-muted-foreground">Reuse an annual, monthly, weekly or daily plan from an earlier year as a template for this year.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field !w-auto max-w-xs" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">— Select a previous plan ({sources.length} available) —</option>
            {sources.map((s) => (
              <option key={`${s.yr}:${s.p.id}`} value={`${s.yr}:${s.p.id}`}>
                [{s.yr}] {s.p.type}: {s.p.title.slice(0, 40)}
              </option>
            ))}
          </select>
          <button className="btn-soft" disabled={!choice || busy} onClick={copyOne}>
            {busy ? "Copying…" : "Copy as new plan"}
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-primary font-medium">{msg}</p>}
    </section>
  );
}

const GUIDE: { step: string; body: string; eg?: string }[] = [
  { step: "१. कक्षा पूर्व (Pre-class) — विद्यार्थीहरू कक्षामा आउनु अघि", body: "विद्यार्थीलाई कक्षामा आउनु अघि पढ्न वा हेर्न दिइने सामग्री (भिडियो, लेख, स्लाइड) र त्यसको आधारमा गर्ने सानो तयारी। यसले कक्षाको समय छलफल र अभ्यासमा लगाउन मद्दत गर्छ।", eg: "युट्युब भिडियो लिङ्क हेरेर आउने र मुख्य ३ वटा बुँदा कापीमा टिप्ने।" },
  { step: "२. कक्षा भित्र (In-class) — कक्षाकोठामा गरिने गतिविधि", body: "कक्षामा शिक्षकले मात्र नबोली विद्यार्थीलाई जोडी वा समूहमा छलफल गराउने, समस्या समाधान गर्ने र शिक्षकले सहजीकरण गर्ने चरणहरू। समय बाँडफाँड (Time management) स्पष्ट हुनुपर्छ।", eg: "१० मिनेट प्रश्नोत्तर, १५ मिनेट समूह कार्य (Group work), १५ मिनेट प्रस्तुतीकरण।" },
  { step: "३. कक्षा पश्चात (Post-class) — कक्षा सकिएपछि", body: "सिकाइलाई बलियो बनाउन कक्षापछि दिइने थप कार्य, असाइनमेन्ट वा परियोजना। विद्यार्थीले घरमा वा इन्टरनेटमा खोजेर गर्ने काम।", eg: "पढेको विषयमा आधारित एउटा वास्तविक उदाहरण खोजेर १०० शब्दमा लेख्ने।" },
  { step: "४. मूल्याङ्कन (Assessment) — सिकाइ जाँच", body: "कक्षा अघि, कक्षा भित्र र कक्षा पछि विद्यार्थीले के कति सिके भनेर जाँच गर्ने तरिका (क्विज, मौखिक प्रश्न, रुब्रिक आदि)।" },
  { step: "५. आत्ममूल्याङ्कन (Self-reflection) — शिक्षकको आफ्नै समीक्षा", body: "कक्षा सकिएपछि शिक्षकले आफैलाई सोध्ने: के योजना अनुसार भयो? विद्यार्थीले बुझे कि बुझेनन्? अर्को पटक के फरक गर्ने? यो कक्षा सकिएपछि भर्ने खण्ड हो।" },
];

function SampleModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="no-print fixed inset-0 z-30 flex items-center justify-center bg-foreground/40 p-3" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-display text-lg text-primary">नमुना ब्लेन्डेड पाठ योजना (Sample Plan)</h3>
          <button className="btn-soft" onClick={onClose}>बन्द गर्नुहोस्</button>
        </div>
        <div className="space-y-3 text-sm">
          <div><span className="font-semibold">पाठ शीर्षक:</span> बजार सन्तुलन (Market Equilibrium) · ४५ मिनेट · BBS I Economics</div>
          <div><span className="font-semibold">सिकाइ उपलब्धि:</span> माग र आपूर्ति रेखाचित्र कोर्न र सन्तुलन मूल्य पत्ता लगाउन सक्नेछन्।</div>
          <div className="rounded-md border border-border p-3">
            <div className="font-semibold text-primary">१. कक्षा पूर्व (Pre-class):</div>
            <div className="mt-1 text-xs"><b>सामग्री:</b> ५ मिनेटको Khan Academy भिडियो लिङ्क भाइबर/मेसेन्जर ग्रुपमा पठाउने।<br /><b>विद्यार्थी कार्य:</b> भिडियो हेरेर माग र आपूर्तिको परिभाषा कापीमा टिपेर आउने।</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="font-semibold text-primary">२. कक्षा भित्र (In-class, ४५ मिनेट):</div>
            <div className="mt-1 text-xs">
              • ०–१० मिनेट: पूर्व-कक्षा सामग्रीमा आधारित छोटो प्रश्नोत्तर र धारणा स्पष्ट पार्ने।<br />
              • १०–२५ मिनेट: ४ जनाको समूह बनाई दिएको तालिकाबाट माग र आपूर्ति रेखाचित्र कोर्ने अभ्यास।<br />
              • २५–३५ मिनेट: प्रत्येक समूहबाट १ जनाले आफ्नो रेखाचित्र बोर्डमा देखाउने।<br />
              • ३५–४५ मिनेट: शिक्षकद्वारा निष्कर्ष र छुटेका कुरा स्पष्ट पार्ने।
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="font-semibold text-primary">३. कक्षा पश्चात (Post-class):</div>
            <div className="mt-1 text-xs"><b>गृहकार्य:</b> स्थानीय तरकारी बजारमा गोलभेडाको भाउ घटबढ हुनुको कारण माग र आपूर्तिको नियमसँग जोडेर १ पृष्ठमा लेख्ने।</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="font-semibold text-primary">४. मूल्याङ्कन (Assessment):</div>
            <div className="mt-1 text-xs">कक्षामा समूह कार्य अवलोकन + गृहकार्य जाँच्ने।</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonSheet({ l, cls }: { l: Lesson; cls: string }) {
  const { profile } = useTeacher();
  return (
    <section className="panel print-only">
      <PrintHead title="Period-wise Lesson Plan" />
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>Class: <b>{cls}</b></div>
        <div>Date: <b>{fmtBs(l.date)}</b></div>
        <div>Time: <b>{l.from} – {l.to}</b></div>
        <div>Teacher: <b>{profile?.name}</b></div>
      </div>
      <div className="mb-2 text-base font-bold">Lesson: {l.title}</div>
      <div className="mb-2 text-sm"><span className="font-semibold">Learning objectives:</span><div className="whitespace-pre-line">{l.objectives}</div></div>
      <table className="rtable mb-3">
        <thead><tr><th>Step & time</th><th>Activity</th><th>Learning theory / model</th></tr></thead>
        <tbody>{(l.steps || []).map((s, i) => (
          <tr key={i}><td><b>{s.step}</b></td><td>{s.activity}</td><td>{s.theory}</td></tr>
        ))}</tbody>
      </table>
      <div className="mb-2 text-sm"><span className="font-semibold">Resources:</span> {l.resources}</div>
      <div className="mb-2 text-sm"><span className="font-semibold">Assessment & feedback:</span> {l.assessment}</div>
      <Signatures roles={[["Subject Teacher", profile?.name], ["Head of Department", profile?.hod], ["Campus Chief", profile?.chief]]} />
    </section>
  );
}

function BlendedSheet({ b, cls }: { b: Blended; cls: string }) {
  const { profile } = useTeacher();
  return (
    <section className="panel print-only">
      <PrintHead title="Blended Learning Lesson Plan" />
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>Class: <b>{cls}</b></div>
        <div>Date: <b>{fmtBs(b.date)}</b></div>
        <div>Duration: <b>{b.duration} min</b></div>
        <div>Teacher: <b>{profile?.name}</b></div>
      </div>
      <div className="mb-2 text-base font-bold">Lesson: {b.title}</div>
      <div className="mb-3 text-sm"><span className="font-semibold">Learning outcomes:</span><div className="whitespace-pre-line">{b.outcomes}</div></div>
      <h3 className="mb-1 font-bold text-sm">१. कक्षा पूर्व (Pre-class activities)</h3>
      <table className="rtable mb-3">
        <thead><tr><th>Teacher's role</th><th>Student's activity</th><th>Materials / Digital tools</th></tr></thead>
        <tbody><tr><td>{b.preTeacher}</td><td>{b.preStudent}</td><td>{b.preMaterials}</td></tr></tbody>
      </table>
      <h3 className="mb-1 font-bold text-sm">२. कक्षा भित्र (In-class activities)</h3>
      <table className="rtable mb-3">
        <thead><tr><th>Time</th><th>Activity</th><th>Digital tools</th><th>Evaluation</th></tr></thead>
        <tbody>{(b.steps || []).map((s, i) => (
          <tr key={i}><td><b>{s.time}</b></td><td>{s.activity}</td><td>{s.tech}</td><td>{s.eval}</td></tr>
        ))}</tbody>
      </table>
      <h3 className="mb-1 font-bold text-sm">३. कक्षा पश्चात (Post-class activities)</h3>
      <table className="rtable mb-3">
        <thead><tr><th>Teacher's role</th><th>Student's activity</th><th>Assignment / Project</th></tr></thead>
        <tbody><tr><td>{b.postTeacher}</td><td>{b.postStudent}</td><td>{b.assignment}</td></tr></tbody>
      </table>
      <Signatures roles={[["Subject Teacher", profile?.name], ["Head of Department", profile?.hod], ["Campus Chief", profile?.chief]]} />
    </section>
  );
}
