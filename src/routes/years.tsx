import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, NeedProfile } from "@/components/app/ui";
import { addAcademicYear, deleteAcademicYear, getCloudState, setActiveAcademicYear, useCloud } from "@/lib/cloud";
import { updateData, useTeacher, type Data } from "@/lib/store";
import { classStudents } from "@/lib/students";
import {
  activeYear,
  currentYear,
  deleteYear,
  isPast,
  keepSubject,
  latestYear,
  nextYearName,
  renameYear,
  setActiveYearLocal,
  startYear,
  switchYear,
  upgradeSubject,
  yearSummaryCounts,
  type CarryRow,
} from "@/lib/years";

export const Route = createFileRoute("/years")({
  head: () => ({
    meta: [
      { title: "Academic years — Shikshak Diary" },
      { name: "description", content: "Open past academic years, start a new year, clean up mistaken years and upgrade class subjects." },
      { property: "og:title", content: "Academic years — Shikshak Diary" },
      { property: "og:description", content: "Open past academic years, start a new year and upgrade class subjects." },
    ],
  }),
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
  const hasCloudActiveInLocal =
    !!cloudActive &&
    data.years.some((x) => x.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase());
  const cur = currentYear(data);
  const latest = latestYear(data);
  const past = isPast(data, cloudActive?.name);
  const isCurActive =
    !!cur &&
    actYr?.id === cur.id &&
    (!cloudActive || cur.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase());

  // Detect any local years that are NOT in the admin's cloud yearList or have 0 diary entries when >1 years exist
  const mistakenYears = data.years.filter((y) => {
    if (data.years.length <= 1) return false;
    const sum = yearSummaryCounts(data, y.id);
    const isCloudActive =
      cloudActive && y.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase();
    if (isCloudActive) return false;
    const inCloudList =
      cl.yearsReady &&
      cl.yearList.some((cy) => cy.name.trim().toLowerCase() === y.name.trim().toLowerCase());
    return !inCloudList || sum.diary === 0;
  });

  // bypass=true allows switching years or admin/cleanup actions even when viewing an inactive year
  const run = (fn: (d: Data) => string | null | void, ok = "", bypass = false) => {
    let err: string | null | void = null;
    updateData((d) => {
      err = fn(d);
    }, bypass);
    setNote(err ? String(err) : ok);
    return !err;
  };

  const makeYearActive = async (targetId: string, targetName: string) => {
    if (!isAdmin) return;
    setBusyActive(true);
    setNote("");
    try {
      updateData((d) => setActiveYearLocal(d, targetId), true);
      if (signedIn && cl.yearsReady) {
        let row = cl.yearList.find((y) => y.name.trim().toLowerCase() === targetName.trim().toLowerCase());
        if (!row) {
          const addErr = await addAcademicYear(targetName);
          if (addErr && !/already exists/i.test(addErr)) {
            setNote(`Local year activated, but cloud update failed: ${addErr}`);
            setBusyActive(false);
            return;
          }
          row = getCloudState().yearList.find(
            (y) => y.name.trim().toLowerCase() === targetName.trim().toLowerCase()
          );
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
      setNote(
        `"${targetName}" is now the Active academic year · "${targetName}" लाई सक्रिय (Active) शैक्षिक वर्ष बनाइयो। अब यस वर्षका बाँकी कामहरू गर्न सकिन्छ।`
      );
    } finally {
      setBusyActive(false);
    }
  };

  const handleDeleteYear = async (targetId: string, targetName: string) => {
    if (data.years.length <= 1) {
      alert("कम्तीमा एउटा शैक्षिक वर्ष हुनुपर्छ, त्यसैले यसलाई हटाउन मिल्दैन।");
      return;
    }
    const counts = yearSummaryCounts(data, targetId);
    const msg =
      counts.diary > 0 || counts.assess > 0
        ? `के तपाइँ साँच्चै "${targetName}" शैक्षिक वर्ष हटाउन चाहनुहुन्छ?\n(यसमा ${counts.classes} कक्षा र ${counts.diary} दैनिक डायरी रेकर्ड छन्। हटाएपछि अघिल्लो/सक्रिय वर्ष खुल्नेछ।)`
        : `गल्तीले बनेको शैक्षिक वर्ष "${targetName}" लाई हटाएर मुख्य सक्रिय वर्षमा फर्कने हो?`;
    if (!confirm(msg)) return;

    const ok = run(
      (d) => deleteYear(d, targetId, cloudActive?.name),
      `शैक्षिक वर्ष "${targetName}" सफलतापूर्वक हटाइयो र मुख्य वर्ष खोलियो।`,
      true
    );

    // If Admin is deleting a year that also exists as an inactive row in cloud academic_years, offer to remove from cloud too
    if (ok && isAdmin && signedIn && cl.yearsReady) {
      const cloudRow = cl.yearList.find(
        (y) => !y.is_active && y.name.trim().toLowerCase() === targetName.trim().toLowerCase()
      );
      if (
        cloudRow &&
        confirm(`के "${targetName}" लाई क्याम्पसको साझा (Cloud) सूचीबाट पनि हटाउने हो?`)
      ) {
        const err = await deleteAcademicYear(cloudRow.id);
        if (err) setNote(`स्थानीय वर्ष हटाइयो, तर क्लाउडबाट हटाउँदा समस्या आयो: ${err}`);
      }
    }
  };

  const openWizard = (forcedName?: string) =>
    setWiz({
      name: forcedName ?? nextYearName(latest?.name ?? cur?.name ?? ""),
      rows: data.classes
        .filter((c) => !c.closed)
        .map((c) => ({ classId: c.id, carry: true, newName: c.name.trim(), students: true })),
      units: true,
      calendar: false,
      lessons: false,
    });

  const setRow = (i: number, p: Partial<CarryRow>) =>
    setWiz((w) => (w ? { ...w, rows: w.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) } : w));

  // Can current user delete the currently open year?
  // Admin can delete any year (as long as >1 years exist); Teacher can delete a mistaken year (0 diary entries or not matching cloudActive)
  const curCounts = cur ? yearSummaryCounts(data, cur.id) : { classes: 0, diary: 0, assess: 0, units: 0 };
  const canDeleteCur =
    data.years.length > 1 &&
    !!cur &&
    (isAdmin ||
      curCounts.diary === 0 ||
      (!!cloudActive && cur.name.trim().toLowerCase() !== cloudActive.name.trim().toLowerCase()));

  return (
    <Page
      title="Academic years · शैक्षिक वर्ष व्यवस्थापन"
      sub="Each year keeps its own diary, plans, records and students. Mistakenly created years can be safely removed."
    >
      {note && (
        <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm font-medium text-primary">
          ✓ {note}
        </div>
      )}

      {/* Alert for teachers who accidentally created an extra/mistaken academic year */}
      {mistakenYears.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm">
          <div className="font-bold text-amber-900 dark:text-amber-200">
            ⚠ झुक्किएर वा गल्तीले बनेको शैक्षिक वर्ष भेटियो ({mistakenYears.map((y) => y.name).join(", ")})
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            यदि शिक्षकबाट गल्तीले नयाँ शैक्षिक वर्ष बनेको हो भने तलको बटन थिचेर त्यसलाई हटाउन र मुख्य शैक्षिक वर्षमा फर्कन सक्नुहुन्छ:
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {mistakenYears.map((my) => {
              const s = yearSummaryCounts(data, my.id);
              return (
                <button
                  key={my.id}
                  type="button"
                  className="btn-danger !py-1.5 !px-3 text-xs"
                  onClick={() => void handleDeleteYear(my.id, my.name)}
                >
                  🗑 "{my.name}" हटाउनुहोस् ({s.diary} डायरी)
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cloudActive && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-secondary/40 p-3 text-sm">
          <div>
            Active academic year · सक्रिय शैक्षिक वर्ष: <b className="text-primary">{cloudActive.name}</b>{" "}
            {hasCloudActiveInLocal ? (
              cur?.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase() ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  — यो वर्ष हाल खुला र सक्रिय छ (Active & Editable)।
                </span>
              ) : null
            ) : (
              <span className="ml-1 text-xs text-muted-foreground">
                — प्रशासनले <b>{cloudActive.name}</b> सुरु गरेको छ।
              </span>
            )}
          </div>
          <div>
            {hasCloudActiveInLocal ? (
              cur?.name.trim().toLowerCase() !== cloudActive.name.trim().toLowerCase() && (
                <button
                  className="btn !py-1.5 !px-3 text-xs"
                  onClick={() => {
                    const t = data.years.find(
                      (x) => x.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase()
                    );
                    if (t) run((d) => switchYear(d, t.id), `Opened ${t.name}.`, true);
                  }}
                >
                  Open {cloudActive.name} · सक्रिय वर्ष खोल्नुहोस्
                </button>
              )
            ) : (
              <button className="btn !py-1.5 !px-3 text-xs" onClick={() => openWizard(cloudActive.name)}>
                + कक्षाहरू {cloudActive.name} मा सार्नुहोस्
              </button>
            )}
          </div>
        </div>
      )}

      <section className="panel mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Years · शैक्षिक वर्षहरू ({data.years.length})</h2>
            <p className="text-xs text-muted-foreground">
              कुनै पनि वर्षमा क्लिक गरेर खोल्नुहोस् वा गल्तीले बनेको वर्ष हटाउनुहोस्।
            </p>
          </div>
          <span className={isCurActive ? "chip-on" : "chip"}>
            {isCurActive
              ? `Active · सक्रिय (${cur?.name})`
              : isAdmin
              ? `Inactive · निष्क्रिय (${cur?.name})`
              : `View only · हेर्न मात्र मिल्ने (${cur?.name})`}
          </span>
        </div>

        {/* Modern Year Cards Grid */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {data.years.map((y) => {
            const isYActive =
              actYr?.id === y.id &&
              (!cloudActive || y.name.trim().toLowerCase() === cloudActive.name.trim().toLowerCase());
            const isYOpen = y.id === cur?.id;
            const counts = yearSummaryCounts(data, y.id);
            const canDelThis =
              data.years.length > 1 &&
              (isAdmin ||
                counts.diary === 0 ||
                (!!cloudActive && y.name.trim().toLowerCase() !== cloudActive.name.trim().toLowerCase()));

            return (
              <div
                key={y.id}
                onClick={() => run((d) => switchYear(d, y.id), `Opened ${y.name}.`, true)}
                className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                  isYOpen
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold text-foreground">{y.name}</span>
                      {isYOpen && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          खुला (Open)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {counts.classes} कक्षा · {counts.diary} डायरी · {counts.units} एकाइ
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isYActive ? (
                      <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Active ✓
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {isAdmin ? "Inactive" : "View only"}
                      </span>
                    )}
                    {canDelThis && (
                      <button
                        type="button"
                        className="mt-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                        title="गल्तीले बनेको यो शैक्षिक वर्ष हटाउनुहोस्"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteYear(y.id, y.name);
                        }}
                      >
                        🗑 हटाउनुहोस्
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {past && !isAdmin && (
          <p className="mt-3 rounded-lg border border-border bg-secondary/40 p-2.5 text-xs text-muted-foreground">
            तपाइँ हाल अघिल्लो/निष्क्रिय शैक्षिक वर्ष (<b>{cur?.name}</b>) मा हुनुहुन्छ। यहाँका रेकर्ड र प्रतिवेदनहरू{" "}
            <b>हेर्न मात्र मिल्छ (View only)</b>। यदि अघिल्लो वर्षको बाँकी काम पूरा गर्नुपर्ने छ भने Admin बाट यस वर्षलाई{" "}
            <b>Active</b> बनाउन लगाउनुहोस्।
          </p>
        )}
        {past && isAdmin && (
          <p className="mt-3 rounded-lg border border-border bg-secondary/40 p-2.5 text-xs text-muted-foreground">
            यो वर्ष (<b>{cur?.name}</b>) हाल निष्क्रिय छ। यदि अघिल्लो वर्षका बाँकी कामहरू शिक्षकहरूबाट पूरा गराउनु छ भने तलको{" "}
            <b>“Make Active · सक्रिय बनाउनुहोस्”</b> बटन थिच्नुहोस्।
          </p>
        )}

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-sm font-medium">वर्षको नाम:</span>
            <input
              id="yrname"
              className="field !w-36"
              defaultValue={cur?.name}
              key={`${cur?.id}-${cur?.name}`}
            />
            <button
              className="btn-soft"
              onClick={() =>
                cur &&
                run(
                  (d) => renameYear(d, cur.id, (document.getElementById("yrname") as HTMLInputElement).value),
                  "Saved.",
                  true
                )
              }
            >
              Save name
            </button>
            <button
              className={isCurActive ? "chip-on !py-2 !px-3" : "btn"}
              disabled={isCurActive || busyActive || !cur}
              onClick={() =>
                cur &&
                confirm(
                  `के तपाइँ "${cur.name}" लाई सक्रिय (Active) शैक्षिक वर्ष बनाउन चाहनुहुन्छ? (यो सक्रिय भएपछि यस वर्षका बाँकी कामहरू सम्पादन गर्न मिल्छ)`
                ) &&
                void makeYearActive(cur.id, cur.name)
              }
            >
              {isCurActive
                ? "Active ✓ · सक्रिय छ"
                : busyActive
                ? "Activating…"
                : `Make Active · ${cur?.name} सक्रिय बनाउनुहोस्`}
            </button>
            {canDeleteCur && cur && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => void handleDeleteYear(cur.id, cur.name)}
              >
                🗑 Delete {cur.name}
              </button>
            )}
            <button className="btn ml-auto" onClick={() => openWizard()}>
              + New academic year · नयाँ शैक्षिक वर्ष
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>नयाँ शैक्षिक वर्ष थप्ने र अघिल्लो वर्षलाई Active गर्ने अधिकार Admin मा मात्र छ।</span>
            <div className="flex flex-wrap gap-2">
              {canDeleteCur && cur && (
                <button
                  type="button"
                  className="btn-danger !py-1.5 !px-3 text-xs"
                  onClick={() => void handleDeleteYear(cur.id, cur.name)}
                >
                  🗑 गल्तीले बनेको "{cur.name}" हटाउनुहोस्
                </button>
              )}
              {cloudActive && !hasCloudActiveInLocal && (
                <button className="btn" onClick={() => openWizard(cloudActive.name)}>
                  + Start {cloudActive.name}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {wiz && (isAdmin || (!!cloudActive && !hasCloudActiveInLocal)) && (
        <section className="panel mb-4 border-primary">
          <h2 className="mb-1 text-lg font-bold">Start new academic year · नयाँ शैक्षिक वर्ष सुरु गर्नुहोस्</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            The open year ({cur?.name}) is saved as it is and can be reopened any time. Diary, attendance, marks, activities, reminders and leave are never carried over. Everything carried over can be edited afterwards.
          </p>
          <div className="mb-3 max-w-xs">
            <label className="lbl">New year name · नयाँ शैक्षिक वर्षको नाम</label>
            <input
              className="field"
              value={wiz.name}
              disabled={!isAdmin}
              onChange={(e) => setWiz({ ...wiz, name: e.target.value })}
            />
            {!isAdmin && <p className="mt-1 text-xs text-muted-foreground">Set by the administrator.</p>}
          </div>
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-2">Carry class</th>
                  <th className="p-2">Class</th>
                  <th className="p-2">Name in new year (e.g. BBS I → BBS II)</th>
                  <th className="p-2">With its students</th>
                </tr>
              </thead>
              <tbody>
                {wiz.rows.map((r, i) => {
                  const c = data.classes.find((x) => x.id === r.classId)!;
                  return (
                    <tr key={r.classId} className="border-b border-border">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={r.carry}
                          onChange={(e) => setRow(i, { carry: e.target.checked })}
                        />
                      </td>
                      <td className="p-2">
                        {c.name} · {c.subject}
                        <div className="text-xs text-muted-foreground">
                          {classStudents(data, c.id).length} students
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          className="field"
                          disabled={!r.carry}
                          value={r.newName}
                          onChange={(e) => setRow(i, { newName: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          disabled={!r.carry}
                          checked={r.students}
                          onChange={(e) => setRow(i, { students: e.target.checked })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <label>
              <input
                type="checkbox"
                className="mr-1"
                checked={wiz.units}
                onChange={(e) => setWiz({ ...wiz, units: e.target.checked })}
              />
              Syllabus units (dates cleared)
            </label>
            <label>
              <input
                type="checkbox"
                className="mr-1"
                checked={wiz.lessons}
                onChange={(e) => setWiz({ ...wiz, lessons: e.target.checked })}
              />
              Lesson plans & plans
            </label>
            <label>
              <input
                type="checkbox"
                className="mr-1"
                checked={wiz.calendar}
                onChange={(e) => setWiz({ ...wiz, calendar: e.target.checked })}
              />
              Academic calendar (edit the dates!)
            </label>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Carried classes are marked "subject not upgraded yet" until you upgrade or confirm the subject below.
          </p>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!confirm(`Save ${cur?.name} and start ${wiz.name}?`)) return;
                const targetName = wiz.name.trim();
                if (
                  run(
                    (d) => startYear(d, wiz),
                    `${targetName} started. Reopen ${cur?.name} from the list above any time.`,
                    true
                  )
                ) {
                  setWiz(null);
                  if (isAdmin && signedIn && cl.yearsReady) {
                    const newY = getCloudState();
                    let row = newY.yearList.find(
                      (y) => y.name.trim().toLowerCase() === targetName.toLowerCase()
                    );
                    if (!row) {
                      await addAcademicYear(targetName);
                      row = getCloudState().yearList.find(
                        (y) => y.name.trim().toLowerCase() === targetName.toLowerCase()
                      );
                    }
                    if (row) await setActiveAcademicYear(row.id);
                  }
                }
              }}
            >
              Start {wiz.name}
            </button>
            <button className="btn-soft" onClick={() => setWiz(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="mb-1 text-lg font-bold">Class subjects in {cur?.name}</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Upgrade a class's subject only when its new subject really starts. The old subject's diary and records stay in a closed class; the students move to the new one.
        </p>
        <div className="space-y-2">
          {data.classes.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border border-border p-3 text-sm transition-colors hover:bg-muted/30 ${
                c.closed ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1">
                  <b>{c.name}</b> · {c.subject} {c.code && `(${c.code})`} · {c.totalLh} LH ·{" "}
                  {classStudents(data, c.id).length} students
                  {c.closed && <span className="chip ml-2">closed · old subject</span>}
                  {c.pending && <span className="chip ml-2">subject not upgraded yet</span>}
                </div>
                {(isCurActive || isAdmin) && !c.closed && c.pending && (
                  <button
                    className="btn-soft"
                    onClick={() => run((d) => keepSubject(d, c.id), "Subject confirmed.")}
                  >
                    Keep same subject
                  </button>
                )}
                {(isCurActive || isAdmin) && !c.closed && (
                  <button
                    className="btn-soft"
                    onClick={() =>
                      setUp({ id: c.id, subject: "", code: "", totalLh: c.totalLh, name: c.name.trim() })
                    }
                  >
                    Upgrade subject…
                  </button>
                )}
              </div>
              {up?.id === c.id && (isCurActive || isAdmin) && (
                <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-4">
                  <input
                    className="field"
                    placeholder="New subject"
                    value={up.subject}
                    onChange={(e) => setUp({ ...up, subject: e.target.value })}
                  />
                  <input
                    className="field"
                    placeholder="Code"
                    value={up.code}
                    onChange={(e) => setUp({ ...up, code: e.target.value })}
                  />
                  <input
                    className="field"
                    type="number"
                    placeholder="Total LH"
                    value={up.totalLh}
                    onChange={(e) => setUp({ ...up, totalLh: Number(e.target.value) })}
                  />
                  <input
                    className="field"
                    placeholder="Class name"
                    value={up.name}
                    onChange={(e) => setUp({ ...up, name: e.target.value })}
                  />
                  <div className="flex gap-2 sm:col-span-4">
                    <button
                      className="btn"
                      onClick={() => {
                        if (run((d) => upgradeSubject(d, c.id, up), `Upgraded to ${up.subject}.`)) setUp(null);
                      }}
                    >
                      Save new subject
                    </button>
                    <button className="btn-soft" onClick={() => setUp(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!data.classes.length && (
            <p className="text-sm text-muted-foreground">No classes in this academic year.</p>
          )}
        </div>
      </section>
    </Page>
  );
}
