import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, Tabs, ClassSelect, BsDate, BsMonth, PrintHead, Signatures, PrintBtn, NeedProfile } from "@/components/app/ui";
import { useTeacher, studentsOf } from "@/lib/store";
import { BS_MONTHS, bsKey, daysInBsMonth, fmtBs, inRange, todayBs, weekday } from "@/lib/bs";
import { lhStats, pct, totalLhDone } from "@/lib/progress";
import { HOLIDAY_TYPES, RESEARCH_CATS } from "@/lib/constants";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [
    { title: "Reports — Shikshak Diary" },
    { name: "description", content: "Monthly performance report, daily report, student report and plan vs progress — all printable." },
    { property: "og:title", content: "Reports — Shikshak Diary" },
    { property: "og:description", content: "Printable monthly, daily, student and progress reports." },
  ] }),
  component: Reports,
});

type T = "month" | "day" | "student" | "progress";

function Reports() {
  const { profile } = useTeacher();
  const [tab, setTab] = useState<T>("month");
  if (!profile) return <NeedProfile />;
  return (
    <Page title="Reports" actions={<PrintBtn />}>
      <Tabs value={tab} onChange={setTab} items={[["month", "Monthly performance"], ["day", "Daily report"], ["student", "Student report"], ["progress", "Plan vs progress"]]} />
      {tab === "month" && <Monthly />}
      {tab === "day" && <Daily />}
      {tab === "student" && <Student />}
      {tab === "progress" && <Progress />}
    </Page>
  );
}

function Monthly() {
  const { profile, data } = useTeacher();
  const [month, setMonth] = useState(todayBs().slice(0, 7));
  const [y, m] = month.split("-").map(Number);
  const days = Array.from({ length: daysInBsMonth(y, m - 1) }, (_, i) => bsKey(y, m - 1, i + 1));
  const cls = data.classes;
  const leave = days.filter((d) => data.cal.some((e) => e.type === "Personal leave" && inRange(d, e.from, e.to))).length;
  const acts = data.acts.filter((a) => a.date.startsWith(month));
  const research = acts.filter((a) => RESEARCH_CATS.includes(a.category));
  const other = acts.filter((a) => !RESEARCH_CATS.includes(a.category));
  return (<>
    <div className="no-print mb-3 w-72"><BsMonth value={month} onChange={setMonth} /></div>
    <section className="panel overflow-x-auto">
      <PrintHead title={<>Teachers' monthly performance report for the month of <b>{BS_MONTHS[m - 1]} {y}</b></>} />
      <div className="mb-2 text-sm">Name: <b>{profile!.name}</b> · {profile!.designation} {profile!.dept && `· ${profile!.dept}`}</div>
      <table className="rtable">
        <thead>
          <tr><th rowSpan={2}>Date</th><th rowSpan={2}>Day</th>{cls.map((c) => <th key={c.id} colSpan={2}>{c.code || c.subject} ({c.name})</th>)}<th rowSpan={2}>Remarks</th></tr>
          <tr>{cls.map((c) => [<th key={c.id + "n"}>No. of Stu</th>, <th key={c.id + "a"}>Activities</th>])}</tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const ev = data.cal.filter((e) => inRange(d, e.from, e.to) && e.type !== "Regular classes");
            const wd = weekday(d);
            return (
              <tr key={d} className={wd === "Sat" || ev.some((e) => HOLIDAY_TYPES.includes(e.type)) ? "bg-muted" : ""}>
                <td className="whitespace-nowrap">{BS_MONTHS[m - 1]} {Number(d.slice(8))}</td><td>{wd}</td>
                {cls.map((c) => {
                  const es = data.diary.filter((e) => e.classId === c.id && e.date === d);
                  return [<td key={c.id + "n"}>{es.length ? es.reduce((a, e) => a + e.total - e.absent.length, 0) : ""}</td>,
                    <td key={c.id + "a"}>{es.length ? `${es.reduce((a, e) => a + e.lh, 0)} ${[...new Set(es.flatMap((e) => e.codes))].join(", ")}` : ""}</td>];
                })}
                <td>{[wd === "Sat" ? "Saturday" : "", ...ev.map((e) => e.title || e.type), ...data.diary.filter((e) => e.date === d && e.remarks).map((e) => e.remarks)].filter(Boolean).join("; ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1 text-[10px] text-muted-foreground">Activities: number = LH taken; L Lecture, ICT, D Discussion, GW Group work, P Presentation, Q Quiz, OQ Oral, SA Student activity, Dm Demonstration, PW Project, CT Class test, R Revision, F Feedback</div>

      <h3 className="mb-1 mt-4 font-bold">Status of Teaching Progress:</h3>
      <table className="rtable">
        <thead><tr><th>Classes and subject code</th>{cls.map((c) => <th key={c.id}>{c.code || c.subject} ({c.name})</th>)}</tr></thead>
        <tbody>
          {([["Total weight in Lecture Hour (LH)", "w"], ["LH completed up to previous month", "prev"], ["LH completed for this month", "thisMonth"], ["Total LH completed up to this month", "total"], ["Course remaining (LH)", "remaining"]] as const).map(([l, k]) => (
            <tr key={k}><td className={k === "total" || k === "w" ? "font-bold" : ""}>{l}</td>{cls.map((c) => { const s = lhStats(data.diary, c.id, c.totalLh, month); return <td key={c.id}>{k === "w" ? c.totalLh : s[k]}</td>; })}</tr>
          ))}
          <tr><td>Total leave days of this month</td><td colSpan={Math.max(1, cls.length)}>{leave || "nil"}</td></tr>
          <tr><td className="font-bold">Progress of research work</td><td colSpan={Math.max(1, cls.length)}>{research.map((a) => `${a.category}: ${a.title}`).join("; ") || "—"}</td></tr>
        </tbody>
      </table>
      <p className="mt-3 text-sm"><b>Additional:</b> {other.map((a) => `${a.title} (${a.category})`).join("; ") || "—"}</p>
      <Signatures roles={[["Submitted by", `${profile!.name}, ${profile!.designation}`], ["Checked by", profile!.hod], ["Approved by", profile!.chief]]} />
    </section>
  </>);
}

function Daily() {
  const { profile, data } = useTeacher();
  const [d, setD] = useState(todayBs());
  const es = data.diary.filter((e) => e.date === d);
  const acts = data.acts.filter((a) => a.date === d);
  return (<>
    <div className="no-print mb-3 w-80"><BsDate value={d} onChange={setD} /></div>
    <section className="panel">
      <PrintHead title={<>Daily Activity Report — {fmtBs(d)} ({weekday(d)})</>} />
      <div className="mb-2 text-sm">Teacher: <b>{profile!.name}</b>, {profile!.designation}</div>
      <table className="rtable text-sm">
        <thead><tr><th>Class</th><th>Topic / LH</th><th>Attendance</th><th>Methods & activities</th><th>Students' activities & feedback</th><th>Evaluation</th></tr></thead>
        <tbody>{es.map((e) => { const c = data.classes.find((x) => x.id === e.classId); return (
          <tr key={e.id}><td>{c?.name}<br />{c?.subject}</td><td>{e.topic}<br />{e.lh} LH</td>
            <td>P {e.total - e.absent.length} / A {e.absent.length}{e.absent.length > 0 && <div className="text-xs">Absent: {e.absent.join(", ")}</div>}{e.reasons && <div className="text-xs">Reason: {e.reasons}</div>}</td>
            <td>{e.methods}<div className="text-xs">{e.codes.join(", ")}</div></td><td>{e.studentActs}{e.feedback && <div className="text-xs">Feedback: {e.feedback}</div>}</td><td>{e.evaluation}</td></tr>); })}
          {!es.length && <tr><td colSpan={6}>No classes recorded.</td></tr>}</tbody>
      </table>
      {acts.length > 0 && <><h3 className="mb-1 mt-3 font-bold">Other activities</h3><ul className="list-disc pl-5 text-sm">{acts.map((a) => <li key={a.id}><b>{a.category}:</b> {a.title} {a.details && `— ${a.details}`}</li>)}</ul></>}
      <Signatures roles={[["Teacher", profile!.name], ["Head of Department", profile!.hod]]} />
    </section>
  </>);
}

function Student() {
  const { data } = useTeacher();
  const [cls, setCls] = useState("");
  const [sel, setSel] = useState("");
  const c = data.classes.find((x) => x.id === cls);
  const stu = studentsOf(c);
  const diary = data.diary.filter((e) => e.classId === cls);
  const as = data.assess.filter((a) => a.classId === cls).sort((a, b) => a.date.localeCompare(b.date));
  const regular = as.filter((a) => a.kind !== "Internal exam" && a.kind !== "Final exam");
  const exam = (k: string, s: string) => as.filter((a) => a.kind === k).map((a) => `${a.marks[s]?.m ?? "-"}/${a.max}`).join(", ") || "—";
  const avg = (s: string) => { const xs = regular.filter((a) => a.marks[s]?.m !== undefined && a.marks[s]?.m !== "" && a.max); return xs.length ? Math.round(xs.reduce((t, a) => t + (Number(a.marks[s].m) / a.max) * 100, 0) / xs.length) + "%" : "—"; };
  return (<>
    <div className="no-print mb-3 flex flex-wrap gap-2"><div className="w-72"><ClassSelect value={cls} onChange={(v) => { setCls(v); setSel(""); }} /></div>
      {c && <select className="field w-60" value={sel} onChange={(e) => setSel(e.target.value)}><option value="">All students (summary)</option>{stu.map((s) => <option key={s}>{s}</option>)}</select>}</div>
    {c && <section className="panel">
      <PrintHead title={<>Student Report — {c.name}, {c.subject} {c.code}</>} />
      {!sel ? (
        <table className="rtable text-sm">
          <thead><tr><th>#</th><th>Student</th><th>Present days</th><th>Assessment avg</th><th>Internal exam</th><th>Final exam</th></tr></thead>
          <tbody>{stu.map((s, i) => { const p = diary.filter((e) => !e.absent.includes(s)).length; return (
            <tr key={s}><td>{i + 1}</td><td>{s}</td><td>{p} / {diary.length} ({pct(p, diary.length)}%)</td><td>{avg(s)}</td><td>{exam("Internal exam", sel || s)}</td><td>{exam("Final exam", s)}</td></tr>); })}</tbody>
        </table>
      ) : (<>
        <div className="mb-2 text-sm">Student: <b>{sel}</b> · Present {diary.filter((e) => !e.absent.includes(sel)).length} of {diary.length} classes</div>
        <table className="rtable text-sm">
          <thead><tr><th>Date</th><th>Assessment</th><th>Marks</th><th>Teacher's comment</th></tr></thead>
          <tbody>{as.map((a) => <tr key={a.id}><td>{fmtBs(a.date)}</td><td>{a.kind} — {a.title}</td><td>{a.marks[sel]?.m ?? "-"} / {a.max}</td><td>{a.marks[sel]?.c}</td></tr>)}</tbody>
        </table>
        <div className="mt-2 text-sm">Absent on: {diary.filter((e) => e.absent.includes(sel)).map((e) => fmtBs(e.date)).join(", ") || "—"}</div>
      </>)}
      <Signatures roles={[["Subject Teacher"], ["Head of Department"]]} />
    </section>}
  </>);
}

function Progress() {
  const { profile, data } = useTeacher();
  return (
    <section className="panel">
      <PrintHead title="Annual Plan vs Actual Teaching Progress" />
      <div className="mb-2 text-sm">Teacher: <b>{profile!.name}</b> · as of {fmtBs(todayBs())}</div>
      {data.classes.map((c) => {
        const units = data.units.filter((u) => u.classId === c.id).sort((a, b) => a.from.localeCompare(b.from));
        const done = totalLhDone(data.diary, c.id);
        return (
          <div key={c.id} className="mb-4">
            <h3 className="font-bold">{c.name} · {c.subject} {c.code} — {done}/{c.totalLh} LH ({pct(done, c.totalLh)}%)</h3>
            <table className="rtable text-sm">
              <thead><tr><th>Unit</th><th>Planned period</th><th>Planned LH</th><th>LH taught</th><th>Status</th></tr></thead>
              <tbody>{units.map((u) => { const t = data.diary.filter((e) => e.unitId === u.id).reduce((a, e) => a + e.lh, 0); const late = todayBs() > u.to && t < u.lh; return (
                <tr key={u.id}><td>{u.unit}</td><td>{fmtBs(u.from)} – {fmtBs(u.to)}</td><td>{u.lh}</td><td>{t}</td><td className={late ? "font-semibold text-destructive" : ""}>{t >= u.lh ? "Completed" : late ? "Behind schedule" : t > 0 ? "In progress" : "Not started"}</td></tr>); })}
                {!units.length && <tr><td colSpan={5}>No units planned.</td></tr>}</tbody>
            </table>
          </div>
        );
      })}
      <Signatures roles={[["Subject Teacher", profile!.name], ["Head of Department", profile!.hod], ["Campus Chief", profile!.chief]]} />
    </section>
  );
}
