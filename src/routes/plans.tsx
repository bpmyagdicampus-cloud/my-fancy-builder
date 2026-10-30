import { createFileRoute, Link } from "@tanstack/react-router";
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
                  <div className="text-xs text-muted-foreground">{g.en}</div>
                  {g.note && <p className="mt-1 text-sm">{g.note}</p>}
                  <ul className="mt-1 space-y-1 text-sm">{g.items.map(([a, b]) => <li key={a}><b>{a}</b> — {b}</li>)}</ul>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn" onClick={() => {
                updateData((d) => {
                  const mbsClass = (d.classes || []).find((x) => x.name.includes("MBS"));
                  d.blended.push({ ...SAMPLE, id: uid(), classId: mbsClass?.id || d.classes[0]?.id || "", date: "2083-07-11" });
                });
                alert("Research Methodology को नमुना पाठ योजना तपाईंको सूचीमा थपियो। तल सूचीबाट 'Edit' वा 'View / print' थिचेर हेर्न सक्नुहुन्छ।");
              }}>Use the sample as a new plan</button>
              <span className="text-xs text-muted-foreground">A copy is added to your list; you can edit it freely. The original sample does not change.</span>
            </div>
            {sample && <div className="mt-3"><BlendedSheet l={SAMPLE} cls={undefined} over={{ level: "MBS III", subject: "Research methodology" }} /></div>}
          </section>
        )}
        <Collection k="blended" title="Blended Learning Lesson Plans" titleExtra={<button className="btn-soft !min-h-8 !py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); setGuide((v) => !v); }}>Guide</button>}
          rowButtons
          fields={[
            { k: "classId", l: "Class / Subject", t: "cls" }, { k: "date", l: "Date", t: "date" },
            { k: "title", l: "Lesson topic" }, { k: "duration", l: "Teaching duration (e.g. 55 mins. 1 Lecture Hour)" },
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
          summary={(l) => (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <b>{l.title || "Untitled Plan"}</b>
                <div className="text-xs text-muted-foreground">
                  <PlanDate d={l.date} /> · {l.duration ? `${l.duration} · ` : ""}{cn(l.classId)}
                </div>
              </div>
              <button
                type="button"
                className="btn-soft"
                onClick={(e) => {
                  e.stopPropagation();
                  setBl(l.id === bl ? "" : l.id);
                }}
              >
                {bl === l.id ? "Hide view" : "View / print"}
              </button>
            </div>
          )} />
        {bp && <BlendedSheet l={bp} cls={(data.classes || []).find((x) => x.id === bp.classId)} />}
      </>)</Page>
  );
}

/**
 * Robust Class Academic Calendar Banner shown inside Annual Unit Plan
 * Shows Net Teaching Days, working days, exam dates, vacation, and compares Planned LH vs Teaching Days!
 * Fully protected against missing tables, null fields or parsing issues to never crash the page.
 */
function ClassAcademicCalendarBanner({ c, yearName, plannedLh }: { c: Cls; yearName: string; plannedLh: number }) {
  const [cal, setCal] = useState<D.ClassAcademicCalendar | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const searchId = c.centralId || c.id;
    D.loadClassCalendar(c.deptId || "", yearName, searchId)
      .then((res) => {
        if (!active) return;
        if (res?.data) {
          setCal(res.data);
          setLoading(false);
        } else {
          D.loadAllClassCalendars(c.deptId || "", yearName)
            .then((list) => {
              if (!active) return;
              const matched = (list || []).find(
                (x) =>
                  (c.centralId && x.class_id === c.centralId) ||
                  (x.class_id && x.class_id === c.id) ||
                  D.normClassName(x.class_name) === D.normClassName(c.name)
              );
              setCal(matched || null);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        }
      })
      .catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [c.id, c.centralId, c.deptId, c.name, yearName]);

  if (loading) return null;
  if (!cal || !Array.isArray(cal.particulars) || cal.particulars.length === 0) {
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

  const parts = cal.particulars;
  const teachingDaysRow = parts.find((p) => p.isTeachingDays);
  const workingDaysRow = parts.find((p) => p.isTotalDays);
  const startRow = parts.find((p) => /start|classes start|सुरु/i.test(p.title));
  const exam1Row = parts.find((p) => /1st|first|प्रथम/i.test(p.title) && /exam|परीक्षा/i.test(p.title));
  const exam2Row = parts.find((p) => /2nd|second|दोस्रो/i.test(p.title) && /exam|परीक्षा/i.test(p.title));
  const exam3Row = parts.find((p) => /3rd|third|तेस्रो/i.test(p.title) && /exam|परीक्षा/i.test(p.title));
  const vacRow = parts.find((p) => /vacation|holiday|हिउँदे|बिदा/i.test(p.title));
  const boardRow = parts.find((p) => /board|final|बोर्ड/i.test(p.title));

  const netTeachingDays = Number(teachingDaysRow?.remarks) || 0;
  const totalWorkingDays = Number(workingDaysRow?.remarks) || 0;

  const extractMilestoneText = (row?: D.CalendarParticularRow) => {
    if (!row) return "—";
    if (row.type === "span") return row.spanText || "—";
    if (!row.values || typeof row.values !== "object") return "—";
    const entries = Object.entries(row.values).filter(([, v]) => Boolean(v && String(v).trim()));
    if (!entries.length) return "—";
    return entries.map(([m, v]) => `${D.BS_MONTH_INFO.find((x) => String(x.bsMonth) === m)?.ne || m}: ${v}`).join(", ");
  };

  const calMonths = Array.isArray(cal.months) && cal.months.length > 0 ? cal.months : D.buildAcademicMonths(cal.start_month || 7, cal.end_month || 4);

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
          <div className="text-muted-foreground text-[11px]">Net Teaching Days · खुद पढाउने दिन</div>
          <div className="text-base font-bold text-primary">{netTeachingDays || "—"} days</div>
          <div className="text-[10px] text-muted-foreground">
            Planned Units: <b>{plannedLh} LH</b> / {c.totalLh} LH
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-2">
          <div className="text-muted-foreground text-[11px]">Total Working Days · कुल कार्यदिन</div>
          <div className="text-base font-bold">{totalWorkingDays || "—"} days</div>
          <div className="text-[10px] text-muted-foreground truncate">
            कक्षा आरम्भ: {extractMilestoneText(startRow)}
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
                    <th className="p-2 text-left">Particulars \ Months (विवरण \ महिना)</th>
                    {calMonths.map((m) => (
                      <th key={m.bsMonth} className="p-2 text-center">
                        <div>{m.nameEn}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{m.nameNe}</div>
                      </th>
                    ))}
                    <th className="p-2 text-center">Remarks (कैफियत)</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((row) => {
                    const isHighlight = row.isTotalDays || row.isTeachingDays;
                    const [enTitle, neTitle] = (row.title || "").split(" · ");
                    return (
                      <tr key={row.id} className={isHighlight ? "bg-muted/40 font-semibold" : ""}>
                        <td className="p-2 align-middle">
                          <div className="font-semibold">{enTitle || row.title}</div>
                          {neTitle && <div className="text-[10px] text-muted-foreground font-normal">{neTitle}</div>}
                        </td>
                        {row.type === "span" ? (
                          <td colSpan={calMonths.length} className="p-2 text-center italic text-muted-foreground">
                            {row.spanText || "—"}
                          </td>
                        ) : (
                          calMonths.map((m) => (
                            <td key={m.bsMonth} className="p-1.5 text-center align-middle">
                              {row.values?.[String(m.bsMonth)] ?? row.values?.[m.nameEn] ?? "—"}
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
              <span>Prepared by: <b>{cal.prepared_name || "Head of Department"}</b></span>
              <span>Approved by: <b>{cal.approved_name || "Campus Chief"}</b></span>
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
  id: "sample", classId: "", date: "2083-07-11", title: "Concept and Meaning of Research", duration: "55 mins. 1 Lecture Hour",
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
};function LessonSheet({ l, cls }: { l: Lesson; cls: string }) {
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

function PlanDate({ d }: { d?: string }) {
  if (!d) return <span>—</span>;
  try {
    const s = String(d).trim();
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return <span>{s}</span>;
    return <Dt d={s} />;
  } catch {
    return <span>{String(d)}</span>;
  }
}

function BlendedSheet({ l, cls, over }: { l: Blended; cls: Cls | undefined; over?: { level: string; subject: string } }) {
  const { profile } = useTeacher();
  const T = (v?: any) => <td className="whitespace-pre-line">{String(v ?? "")}</td>;
  const row = (a: string, v?: any) => <tr key={a}><td className="w-56 font-medium">{a}</td>{T(v)}</tr>;
  const steps = Array.isArray(l?.steps) ? l.steps : [];
  const safeDate = l?.date ? (/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(l.date).trim()) ? fmtBs(String(l.date)) : String(l.date)) : "";

  return (
    <section className="panel mt-4">
      <PrintHead title="Blended Learning Lesson Plan" />
      <h3 className="mb-1 mt-2 font-semibold">1. Basic information</h3>
      <table className="rtable text-sm"><tbody>
        {row("Teacher", profile?.name ?? "")}
        {row("Class / Level", over?.level ?? cls?.name ?? "")}
        {row("Subject", over?.subject ?? (cls ? `${cls.subject}${cls.code ? ` (${cls.code})` : ""}` : ""))}
        {row("Lesson topic", l?.title ?? "")}
        {row("Date", safeDate)}
        {row("Teaching duration", l?.duration ?? "")}
        {row("Teaching model", "Blended Learning")}
      </tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">2. Learning outcomes</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l?.outcomes)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">3. Pre-class learning</h3>
      <table className="rtable text-sm"><tbody>
        {row("Teacher's activities", l?.preTeacher)}
        {row("Students' activities", l?.preStudent)}
        {row("Learning materials", l?.preMaterials)}
      </tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">4. Face-to-face learning activities</h3>
      <table className="rtable text-sm">
        <thead><tr><th className="w-24">Time</th><th>Teacher's activities</th><th>Students' activities</th><th>Teaching methods / materials</th></tr></thead>
        <tbody>{steps.map((s: any, i: number) => (
          <tr key={i}>
            {T(s?.time)}
            {T(s?.teacher || s?.activity)}
            {T(s?.student)}
            {T(s?.methods || s?.tech || s?.eval)}
          </tr>
        ))}</tbody>
      </table>
      <h3 className="mb-1 mt-4 font-semibold">5. Post-class learning</h3>
      <table className="rtable text-sm"><tbody>
        {row("Teacher's activities", l?.postTeacher)}
        {row("Students' activities", l?.postStudent)}
        {row("Assignment / practice", l?.assignment)}
      </tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">6. Learning resources and technology</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l?.resources)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">7. Assessment</h3>
      <table className="rtable text-sm"><tbody>
        {row("Pre-class assessment", l?.asPre)}
        {row("In-class assessment", l?.asIn)}
        {row("Post-class assessment", l?.asPost)}
      </tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">8. Feedback and improvement</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l?.feedback)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">9. Offline learning alternative</h3>
      <table className="rtable text-sm"><tbody><tr>{T(l?.offline)}</tr></tbody></table>
      <h3 className="mb-1 mt-4 font-semibold">10. Teacher reflection</h3>
      <table className="rtable text-sm"><tbody>
        {row("Were the learning outcomes achieved?", l?.refAchieved)}
        {row("What difficulties did students face?", l?.refDifficulty)}
        {row("What worked well?", l?.refWorked)}
        {row("What should be improved in the next lesson?", l?.refImprove)}
      </tbody></table>
      <Signatures roles={[["Subject Teacher", profile?.name], ["Head of Department", profile?.hod]]} />
    </section>
  );
}