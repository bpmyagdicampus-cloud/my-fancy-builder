import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, NeedProfile } from "@/components/app/ui";
import { useCloud } from "@/lib/cloud";
import { updateData, useTeacher, type Data } from "@/lib/store";
import { classStudents } from "@/lib/students";
import { currentYear, isPast, keepSubject, latestYear, nextYearName, renameYear, startYear, switchYear, upgradeSubject, type CarryRow } from "@/lib/years";

export const Route = createFileRoute("/years")({
  head: () => ({ meta: [
    { title: "Academic years — Shikshak Diary" },
    { name: "description", content: "Open past academic years, start a new year and upgrade class subjects." },
    { property: "og:title", content: "Academic years — Shikshak Diary" },
    { property: "og:description", content: "Open past academic years, start a new year and upgrade class subjects." },
  ] }),
  component: Years,
});

type Wiz = { name: string; rows: CarryRow[]; units: boolean; calendar: boolean; lessons: boolean };
type Up = { id: string; subject: string; code: string; totalLh: number; name: string };

function Years() {
  const { profile, data } = useTeacher();
  const [wiz, setWiz] = useState<Wiz | null>(null);
  const [up, setUp] = useState<Up | null>(null);
  const [note, setNote] = useState("");
  const cl = useCloud();
  if (!profile) return <NeedProfile />;
  // The administrator decides which academic year is active (when that feature is installed).
  const active = cl.yearsReady ? cl.activeYear : null;
  const hasActive = !!active && data.years.some((x) => x.name.toLowerCase() === active.name.toLowerCase());
  const mayStart = !active || !hasActive;
  const cur = currentYear(data);
  const latest = latestYear(data);
  const past = isPast(data);

  const run = (fn: (d: Data) => string | null | void, ok = "") => {
    let err: string | null | void = null;
    updateData((d) => { err = fn(d); });
    setNote(err ? String(err) : ok);
    return !err;
  };
  const openWizard = () => setWiz({
    name: active ? active.name : nextYearName(latest?.name ?? cur?.name ?? ""),
    rows: data.classes.filter((c) => !c.closed).map((c) => ({ classId: c.id, carry: true, newName: c.name.trim(), students: true })),
    units: true, calendar: false, lessons: false,
  });
  const setRow = (i: number, p: Partial<CarryRow>) => setWiz((w) => (w ? { ...w, rows: w.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) } : w));

  return (
    <Page title="Academic years · शैक्षिक वर्ष" sub="Each year keeps its own diary, plans, records and students. Nothing is deleted when you start a new year.">
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}

      {active && (
        <p className="mb-3 rounded-md border border-primary p-2 text-sm">
          Active academic year (set by the administrator): <b>{active.name}</b>.{" "}
          {hasActive
            ? (cur?.name.toLowerCase() === active.name.toLowerCase() ? "It is open in your diary." : <button className="underline" onClick={() => { const t = data.years.find((x) => x.name.toLowerCase() === active.name.toLowerCase()); if (t) run((d) => switchYear(d, t.id), `Opened ${t.name}.`); }}>Open it</button>)
            : "Start it below to carry your classes forward."}
        </p>
      )}
      <section className="panel mb-4">
        <h2 className="mb-2 text-lg font-bold">Years</h2>
        <div className="flex flex-wrap items-center gap-2">
          {data.years.map((y) => (
            <button key={y.id} className={y.id === cur?.id ? "btn" : "btn-soft"} onClick={() => run((d) => switchYear(d, y.id), `Opened ${y.name}.`)}>
              {y.name}{y.id === latest?.id ? " · latest" : ""}{y.id === cur?.id ? " · open" : ""}
            </button>
          ))}
        </div>
        {past && <p className="mt-2 text-xs text-muted-foreground">An old year is open. Edits go into that year. Open the latest year to continue daily work.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm">Rename open year:</span>
          <input id="yrname" className="field !w-40" defaultValue={cur?.name} key={`${cur?.id}-${cur?.name}`} />
          <button className="btn-soft" onClick={() => cur && run((d) => renameYear(d, cur.id, (document.getElementById("yrname") as HTMLInputElement).value), "Renamed.")}>Save</button>
          {mayStart ? <button className="btn ml-auto" onClick={openWizard}>+ Start {active ? active.name : "new academic year"}</button> : <span className="ml-auto text-xs text-muted-foreground">Only the administrator can activate the next year.</span>}
        </div>
      </section>

      {wiz && (
        <section className="panel mb-4 border-primary">
          <h2 className="mb-1 text-lg font-bold">Start new academic year</h2>
          <p className="mb-3 text-xs text-muted-foreground">The open year ({cur?.name}) is saved as it is and can be reopened any time. Diary, attendance, marks, activities, reminders and leave are never carried over. Everything carried over can be edited afterwards.</p>
          <div className="mb-3 max-w-xs"><label className="lbl">New year name</label><input className="field" value={wiz.name} disabled={!!active} onChange={(e) => setWiz({ ...wiz, name: e.target.value })} />{active && <p className="mt-1 text-xs text-muted-foreground">Set by the administrator.</p>}</div>
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-2">Carry class</th><th className="p-2">Class</th><th className="p-2">Name in new year (e.g. BBS I → BBS II)</th><th className="p-2">With its students</th></tr></thead>
              <tbody>
                {wiz.rows.map((r, i) => {
                  const c = data.classes.find((x) => x.id === r.classId)!;
                  return (
                    <tr key={r.classId} className="border-b border-border">
                      <td className="p-2"><input type="checkbox" checked={r.carry} onChange={(e) => setRow(i, { carry: e.target.checked })} /></td>
                      <td className="p-2">{c.name} · {c.subject}<div className="text-xs text-muted-foreground">{classStudents(data, c.id).length} students</div></td>
                      <td className="p-2"><input className="field" disabled={!r.carry} value={r.newName} onChange={(e) => setRow(i, { newName: e.target.value })} /></td>
                      <td className="p-2"><input type="checkbox" disabled={!r.carry} checked={r.students} onChange={(e) => setRow(i, { students: e.target.checked })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <label><input type="checkbox" className="mr-1" checked={wiz.units} onChange={(e) => setWiz({ ...wiz, units: e.target.checked })} />Syllabus units (dates cleared)</label>
            <label><input type="checkbox" className="mr-1" checked={wiz.lessons} onChange={(e) => setWiz({ ...wiz, lessons: e.target.checked })} />Lesson plans & plans</label>
            <label><input type="checkbox" className="mr-1" checked={wiz.calendar} onChange={(e) => setWiz({ ...wiz, calendar: e.target.checked })} />Academic calendar (edit the dates!)</label>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Carried classes are marked "subject not upgraded yet" until you upgrade or confirm the subject below.</p>
          <div className="flex gap-2">
            <button className="btn" onClick={() => confirm(`Save ${cur?.name} and start ${wiz.name}?`) && run((d) => startYear(d, wiz), `${wiz.name} started. Reopen ${cur?.name} from the list above any time.`) && setWiz(null)}>Start {wiz.name}</button>
            <button className="btn-soft" onClick={() => setWiz(null)}>Cancel</button>
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="mb-1 text-lg font-bold">Class subjects in {cur?.name}</h2>
        <p className="mb-3 text-xs text-muted-foreground">Upgrade a class's subject only when its new subject really starts. The old subject's diary and records stay in a closed class; the students move to the new one.</p>
        <div className="space-y-2">
          {data.classes.map((c) => (
            <div key={c.id} className={`rounded-md border border-border p-2 text-sm ${c.closed ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1"><b>{c.name}</b> · {c.subject} {c.code && `(${c.code})`} · {c.totalLh} LH · {classStudents(data, c.id).length} students
                  {c.closed && <span className="chip ml-2">closed · old subject</span>}{c.pending && <span className="chip ml-2">subject not upgraded yet</span>}</div>
                {!c.closed && c.pending && <button className="btn-soft" onClick={() => run((d) => keepSubject(d, c.id), "Subject confirmed.")}>Keep same subject</button>}
                {!c.closed && <button className="btn-soft" onClick={() => setUp({ id: c.id, subject: "", code: "", totalLh: c.totalLh, name: c.name.trim() })}>Upgrade subject…</button>}
              </div>
              {up?.id === c.id && (
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <input className="field" placeholder="New subject" value={up.subject} onChange={(e) => setUp({ ...up, subject: e.target.value })} />
                  <input className="field" placeholder="Code" value={up.code} onChange={(e) => setUp({ ...up, code: e.target.value })} />
                  <input className="field" type="number" placeholder="Total LH" value={up.totalLh} onChange={(e) => setUp({ ...up, totalLh: Number(e.target.value) })} />
                  <input className="field" placeholder="Class name" value={up.name} onChange={(e) => setUp({ ...up, name: e.target.value })} />
                  <div className="flex gap-2 sm:col-span-4">
                    <button className="btn" onClick={() => confirm(`Close "${c.subject}" and start "${up.subject}" for ${up.name}? Students move to the new class.`) && run((d) => upgradeSubject(d, c.id, up), "Subject upgraded.") && setUp(null)}>Upgrade</button>
                    <button className="btn-soft" onClick={() => setUp(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!data.classes.length && <p className="text-sm text-muted-foreground">No classes in this year yet.</p>}
        </div>
      </section>
    </Page>
  );
}
