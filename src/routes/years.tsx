import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, NeedProfile } from "@/components/app/ui";
import { addAcademicYear, getCloudState, setActiveAcademicYear, useCloud } from "@/lib/cloud";
import { updateData, useTeacher, type Data } from "@/lib/store";
import { classStudents } from "@/lib/students";
import { activeYear, currentYear, isPast, keepSubject, latestYear, nextYearName, renameYear, setActiveYearLocal, startYear, switchYear, upgradeSubject, type CarryRow } from "@/lib/years";

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
  const [busyActive, setBusyActive] = useState(false);
  const cl = useCloud();
  if (!profile) return <NeedProfile />;

  const signedIn = cl.status === "ready" && !!cl.userId;
  const isAdmin = signedIn ? cl.roles.includes("admin") : cl.localMode;

  const cloudActive = cl.yearsReady ? cl.activeYear : null;
  const actYr = activeYear(data, cloudActive?.name);
  const hasCloudActiveInLocal = !!cloudActive && data.years.some((x) => x.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase());
  const cur = currentYear(data);
  const latest = latestYear(data);
  const past = isPast(data, cloudActive?.name);
  const isCurActive = !!cur && actYr?.id === cur.id && (!cloudActive || cur.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase());

  // bypass=true allows switching years or admin actions even when viewing an inactive year
  const run = (fn: (d: Data) => string | null | void, ok = "", bypass = false) => {
    let err: string | null | void = null;
    updateData((d) => { err = fn(d); }, bypass);
    setNote(err ? String(err) : ok);
    return !err;
  };

  const makeYearActive = async (targetId: string, targetName: string) => {
    if (!isAdmin) return;
    setBusyActive(true);
    setNote("");
    try {
      // 1. Update local activeYearId and open it
      updateData((d) => setActiveYearLocal(d, targetId), true);
      // 2. If connected to Cloud academic_years table, also make it active globally for everyone
      if (signedIn && cl.yearsReady) {
        let row = cl.yearList.find((y) => y.name.trim().toLowerCase() === targetName.trim().toLowerCase());
        if (!row) {
          const addErr = await addAcademicYear(targetName);
          if (addErr && !/already exists/i.test(addErr)) {
            setNote(`Local year activated, but cloud update failed: ${addErr}`);
            setBusyActive(false);
            return;
          }
          row = getCloudState().yearList.find((y) => y.name.trim().toLowerCase() === targetName.trim().toLowerCase());
        }
        if (row && !row.is_active) {
          const actErr = await setActiveAcademicYear(row.id);
          if (actErr) {
            setNote(`Local year activated, but cloud activation failed: ${actErr}`);
            setBusyActive(false);
            return;
          }
        }
      }
      setNote(`"${targetName}" is now the Active academic year · "${targetName}" लाई सक्रिय (Active) शैक्षिक वर्ष बनाइयो। अब यस वर्षका बाँकी कामहरू गर्न सकिन्छ।`);
    } finally {
      setBusyActive(false);
    }
  };

  const openWizard = (forcedName?: string) => setWiz({
    name: forcedName ?? nextYearName(latest?.name ?? cur?.name ?? ""),
    rows: data.classes.filter((c) => !c.closed).map((c) => ({ classId: c.id, carry: true, newName: c.name.trim(), students: true })),
    units: true, calendar: false, lessons: false,
  });
  const setRow = (i: number, p: Partial<CarryRow>) => setWiz((w) => (w ? { ...w, rows: w.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) } : w));

  return (
    <Page title="Academic years · शैक्षिक वर्ष" sub="Each year keeps its own diary, plans, records and students. Nothing is deleted when you start a new year.">
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}

      {cloudActive && (
        <p className="mb-3 rounded-md border border-primary p-2 text-sm">
          Active academic year · सक्रिय शैक्षिक वर्ष: <b>{cloudActive.name}</b>.{" "}
          {hasCloudActiveInLocal
            ? (cur?.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase()
                ? "यो वर्ष हाल खुला र सक्रिय छ (Active & Editable)।"
                : <button className="underline font-semibold" onClick={() => { const t = data.years.find((x) => x.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase()); if (t) run((d) => switchYear(d, t.id), `Opened ${t.name}.`, true); }}>Open {cloudActive.name} · सक्रिय वर्ष खोल्नुहोस्</button>)
            : <>प्रशासनले <b>{cloudActive.name}</b> सुरु गरेको छ। <button className="underline font-semibold" onClick={() => openWizard(cloudActive.name)}>यहाँ क्लिक गरेर आफ्ना कक्षाहरू {cloudActive.name} मा सार्नुहोस्</button>।</>}
        </p>
      )}

      <section className="panel mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Years · शैक्षिक वर्षहरू</h2>
          <span className="chip">{isCurActive ? `Active · सक्रिय (${cur?.name})` : isAdmin ? `Inactive · निष्क्रिय (${cur?.name})` : `View only · हेर्न मात्र मिल्ने (${cur?.name})`}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data.years.map((y) => {
            const isYActive = actYr?.id === y.id && (!cloudActive || y.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase());
            const isYOpen = y.id === cur?.id;
            return (
              <button
                key={y.id}
                className={isYOpen ? "btn" : "btn-soft"}
                onClick={() => run((d) => switchYear(d, y.id), `Opened ${y.name}.`, true)}
              >
                {y.name}
                {isYActive ? " · Active ✓" : !isAdmin ? " · View only" : ""}
                {isYOpen ? " · (खुला)" : ""}
              </button>
            );
          })}
        </div>

        {past && !isAdmin && (
          <p className="mt-3 rounded-md border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
            तपाइँ हाल अघिल्लो/निष्क्रिय शैक्षिक वर्ष (<b>{cur?.name}</b>) मा हुनुहुन्छ। यहाँका रेकर्ड र प्रतिवेदनहरू <b>हेर्न मात्र मिल्छ (View only)</b>। यदि अघिल्लो वर्षको बाँकी काम पूरा गर्नुपर्ने छ भने Admin बाट यस वर्षलाई <b>Active</b> बनाउन लगाउनुहोस्।
          </p>
        )}
        {past && isAdmin && (
          <p className="mt-3 rounded-md border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
            यो वर्ष (<b>{cur?.name}</b>) हाल निष्क्रिय छ। यदि अघिल्लो वर्षका बाँकी कामहरू शिक्षकहरूबाट पूरा गराउनु छ भने तलको <b>“Make Active · सक्रिय बनाउनुहोस्”</b> बटन थिच्नुहोस्।
          </p>
        )}

        {isAdmin ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-sm">Academic year name · वर्षको नाम:</span>
            <input id="yrname" className="field !w-40" defaultValue={cur?.name} key={`${cur?.id}-${cur?.name}`} />
            <button
              className="btn-soft"
              onClick={() => cur && run((d) => renameYear(d, cur.id, (document.getElementById("yrname") as HTMLInputElement).value), "Saved.", true)}
            >
              Save
            </button>
            <button
              className={isCurActive ? "chip-on" : "btn"}
              disabled={isCurActive || busyActive || !cur}
              onClick={() => cur && confirm(`के तपाइँ "${cur.name}" लाई सक्रिय (Active) शैक्षिक वर्ष बनाउन चाहनुहुन्छ? (यो सक्रिय भएपछि यस वर्षका बाँकी कामहरू सम्पादन गर्न मिल्छ)`) && void makeYearActive(cur.id, cur.name)}
            >
              {isCurActive ? "Active ✓ · सक्रिय छ" : busyActive ? "Activating…" : `Make Active · ${cur?.name} सक्रिय बनाउनुहोस्`}
            </button>
            <button className="btn ml-auto" onClick={() => openWizard()}>
              + New academic year · नयाँ शैक्षिक वर्ष
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            <span>नयाँ शैक्षिक वर्ष थप्ने र अघिल्लो वर्षलाई Active गर्ने अधिकार Admin मा मात्र छ।</span>
            {cloudActive && !hasCloudActiveInLocal && (
              <button className="btn" onClick={() => openWizard(cloudActive.name)}>
                + Start {cloudActive.name}
              </button>
            )}
          </div>
        )}
      </section>

      {wiz && (isAdmin || (!!cloudActive && !hasCloudActiveInLocal)) && (
        <section className="panel mb-4 border-primary">
          <h2 className="mb-1 text-lg font-bold">Start new academic year · नयाँ शैक्षिक वर्ष सुरु गर्नुहोस्</h2>
          <p className="mb-3 text-xs text-muted-foreground">The open year ({cur?.name}) is saved as it is and can be reopened any time. Diary, attendance, marks, activities, reminders and leave are never carried over. Everything carried over can be edited afterwards.</p>
          <div className="mb-3 max-w-xs">
            <label className="lbl">New year name · नयाँ शैक्षिक वर्षको नाम</label>
            <input className="field" value={wiz.name} disabled={!isAdmin} onChange={(e) => setWiz({ ...wiz, name: e.target.value })} />
            {!isAdmin && <p className="mt-1 text-xs text-muted-foreground">Set by the administrator.</p>}
          </div>
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
            <button
              className="btn"
              onClick={async () => {
                if (!confirm(`Save ${cur?.name} and start ${wiz.name}?`)) return;
                const targetName = wiz.name.trim();
                if (run((d) => startYear(d, wiz), `${targetName} started. Reopen ${cur?.name} from the list above any time.`, true)) {
                  setWiz(null);
                  if (isAdmin && signedIn && cl.yearsReady) {
                    const newY = getCloudState();
                    let row = newY.yearList.find((y) => y.name.trim().toLowerCase() === targetName.toLowerCase());
                    if (!row) {
                      await addAcademicYear(targetName);
                      row = getCloudState().yearList.find((y) => y.name.trim().toLowerCase() === targetName.toLowerCase());
                    }
                    if (row) await setActiveAcademicYear(row.id);
                  }
                }
              }}
            >
              Start {wiz.name}
            </button>
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
                {(isCurActive || isAdmin) && !c.closed && c.pending && <button className="btn-soft" onClick={() => run((d) => keepSubject(d, c.id), "Subject confirmed.")}>Keep same subject</button>}
                {(isCurActive || isAdmin) && !c.closed && <button className="btn-soft" onClick={() => setUp({ id: c.id, subject: "", code: "", totalLh: c.totalLh, name: c.name.trim() })}>Upgrade subject…</button>}
              </div>
              {up?.id === c.id && (isCurActive || isAdmin) && (
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
