import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, BsDate, ClassSelect, NeedProfile, Dt } from "@/components/app/ui";
import {
  updateData,
  uid,
  useTeacher,
  studentsOf,
  absentNamesOf,
  presentCountOf,
  absentCountOf,
  type Diary,
} from "@/lib/store";
import { todayBs, weekday, inRange, fmtBs } from "@/lib/bs";
import { CODES, HOLIDAY_TYPES } from "@/lib/constants";
import { weeklyOffOf } from "@/lib/migrate";

export const Route = createFileRoute("/diary")({
  head: () => ({
    meta: [
      { title: "Daily Diary — Shikshak Diary" },
      { name: "description", content: "Record daily classes: attendance, remarks, activities, methods, feedback and evaluation." },
      { property: "og:title", content: "Daily Diary — Shikshak Diary" },
      { property: "og:description", content: "Record daily classes: attendance, activities, methods and feedback." },
    ],
  }),
  component: DiaryPage,
});

const blank = (classId = "", defaultTotal = 0): Diary => ({
  id: "",
  classId,
  date: todayBs(),
  total: defaultTotal,
  present: defaultTotal,
  absent: [],
  reasons: "",
  codes: [],
  lh: 1,
  unitId: "",
  topic: "",
  methods: "",
  studentActs: "",
  feedback: "",
  evaluation: "",
  remarks: "",
  remarkInMonthly: false,
});

function DiaryPage() {
  const { profile, data } = useTeacher();
  const [ed, setEd] = useState<Diary | null>(null);
  const [fc, setFc] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [editingCount, setEditingCount] = useState<"total" | "present" | "absent" | null>(null);
  const [manualCount, setManualCount] = useState(false);

  if (!profile) return <NeedProfile />;

  const cls = data.classes.find((c) => c.id === ed?.classId);
  const stu = studentsOf(cls);
  const classStuCount = stu.length;

  const set = (p: Partial<Diary>) => setEd((e) => (e ? { ...e, ...p } : e));

  const startNewEntry = () => {
    const c = data.classes.find((x) => x.id === fc);
    const count = studentsOf(c).length;
    setEditingCount(null);
    setManualCount(false);
    setShowMoreDetails(false);
    setEd(blank(fc, count));
  };

  const openExistingEntry = (d: Diary) => {
    const copy = structuredClone(d);
    const c = data.classes.find((x) => x.id === copy.classId);
    const defaultTotal = studentsOf(c).length;
    const total = copy.total || defaultTotal;
    const realAbs = absentNamesOf(copy);
    const p = presentCountOf({ ...copy, total });
    copy.total = total;
    copy.present = p;
    copy.absent = realAbs;
    setEditingCount(null);
    setManualCount(p !== Math.max(0, total - realAbs.length));
    setShowMoreDetails(!!(copy.methods || copy.studentActs || copy.feedback || copy.evaluation));
    setEd(copy);
  };

  const pickClass = (id: string) => {
    const c = data.classes.find((x) => x.id === id);
    const count = studentsOf(c).length;
    setEditingCount(null);
    setManualCount(false);
    set({ classId: id, total: count, present: count, absent: [], unitId: "" });
  };

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const realAbsent = absentNamesOf(ed);
  const pCount = presentCountOf(ed);
  const aCount = absentCountOf(ed);

  const handleTotalChange = (rawVal: string) => {
    const nextTotal = Math.max(0, Number(rawVal) || 0);
    if (!ed) return;
    const nextPresent = manualCount
      ? Math.min(nextTotal, pCount)
      : Math.max(0, nextTotal - realAbsent.length);
    set({ total: nextTotal, present: nextPresent });
  };

  const handlePresentChange = (rawVal: string) => {
    const nextPresent = Math.max(0, Number(rawVal) || 0);
    if (!ed) return;
    const nextTotal = nextPresent > ed.total ? nextPresent : ed.total;
    setManualCount(true);
    set({ total: nextTotal, present: nextPresent });
  };

  const handleAbsentCountChange = (rawVal: string) => {
    const nextAbsentCount = Math.max(0, Number(rawVal) || 0);
    if (!ed) return;
    const nextTotal = nextAbsentCount > ed.total ? nextAbsentCount : ed.total;
    setManualCount(true);
    set({ total: nextTotal, present: Math.max(0, nextTotal - nextAbsentCount) });
  };

  const handleToggleStudentAbsent = (studentName: string) => {
    if (!ed) return;
    const nextAbsent = toggle(realAbsent, studentName);
    if (manualCount) {
      set({ absent: nextAbsent });
    } else {
      set({
        absent: nextAbsent,
        present: Math.max(0, ed.total - nextAbsent.length),
      });
    }
  };

  const syncCountWithStudentAttendance = () => {
    if (!ed) return;
    setManualCount(false);
    setEditingCount(null);
    set({ present: Math.max(0, ed.total - realAbsent.length) });
  };

  const save = () => {
    if (!ed?.classId) return alert("Select a class");
    const isOff = weeklyOffOf(data).includes(weekday(ed.date));
    const isHoliday = data.cal.some((e) => HOLIDAY_TYPES.includes(e.type) && inRange(ed.date, e.from, e.to));
    const onLeave = data.leaves.some((l) => inRange(ed.date, l.from, l.to));
    if (
      (isOff || isHoliday || onLeave) &&
      !confirm(
        `${fmtBs(ed.date)} is marked as ${isOff ? "a weekly holiday" : isHoliday ? "a holiday" : "your leave"}. Save this entry anyway?`
      )
    )
      return;
    if (
      data.diary.some((x) => x.id !== ed.id && x.classId === ed.classId && x.date === ed.date) &&
      !confirm("An entry for this class on this date already exists. Save another one?")
    )
      return;

    const cleanEntry: Diary = {
      ...ed,
      present: pCount,
      absent: realAbsent,
      remarkInMonthly: !!ed.remarkInMonthly,
    };

    updateData((d) => {
      const i = d.diary.findIndex((x) => x.id === cleanEntry.id);
      if (i >= 0) d.diary[i] = cleanEntry;
      else d.diary.push({ ...cleanEntry, id: uid() });
    });
    setEd(null);
  };

  const list = data.diary
    .filter((d) => {
      if (fc && d.classId !== fc) return false;
      if (!searchQ.trim()) return true;
      const q = searchQ.trim().toLowerCase();
      return (
        (d.topic || "").toLowerCase().includes(q) ||
        (d.remarks || "").toLowerCase().includes(q) ||
        (d.reasons || "").toLowerCase().includes(q) ||
        d.date.includes(q)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const area = (k: keyof Diary, l: string) => (
    <div>
      <label className="lbl">{l}</label>
      <textarea
        className="field min-h-16"
        value={(ed![k] as string) || ""}
        onChange={(e) => set({ [k]: e.target.value })}
      />
    </div>
  );

  return (
    <Page
      title="Daily diary · दैनिक डायरी"
      sub="प्रत्येक कक्षाको हाजिरी, पाठ विवरण, शिक्षण क्रियाकलाप र कैफियत अभिलेख"
      actions={!ed && <button className="btn" onClick={startNewEntry}>+ New entry · नयाँ इन्ट्री</button>}
    >
      {ed && (
        <section className="panel mb-5 space-y-4 border-primary/30 shadow-md">
          <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
            <h2 className="text-base font-bold text-primary">
              {ed.id ? "✏️ दैनिक डायरी सम्पादन (Edit Entry)" : "➕ नयाँ दैनिक डायरी (New Daily Entry)"}
            </h2>
            <button type="button" className="btn-soft !min-h-8 !px-2.5 !py-1 text-xs" onClick={() => setEd(null)}>
              ✕ बन्द गर्नुहोस्
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="lbl">Class · कक्षा र विषय</label>
              <ClassSelect active value={ed.classId} onChange={pickClass} />
            </div>
            <div>
              <label className="lbl">Date (BS) · मिति</label>
              <BsDate value={ed.date} onChange={(v) => set({ date: v })} />
            </div>
            <div>
              <label className="lbl">Lecture hours taught · घण्टी (LH)</label>
              <input
                type="number"
                className="field"
                value={ed.lh}
                onChange={(e) => set({ lh: +e.target.value })}
              />
            </div>
            <div>
              <label className="lbl">Unit · एकाइ</label>
              <select
                className="field"
                value={ed.unitId}
                onChange={(e) => set({ unitId: e.target.value })}
              >
                <option value="">— Select unit —</option>
                {data.units
                  .filter((u) => u.classId === ed.classId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="lbl">Topic taught · पढाएको शीर्षक / पाठ</label>
              <input
                className="field"
                placeholder="आज पढाएको मुख्य पाठ वा विषयवस्तु लेख्नुहोस्..."
                value={ed.topic}
                onChange={(e) => set({ topic: e.target.value })}
              />
            </div>
          </div>

          {/* Student Headcount & Attendance Section */}
          <div className="rounded-xl border border-border bg-muted/50 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 text-sm">
                {/* Total Students: shows class student count by default, click to edit */}
                <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 shadow-sm">
                  <span className="text-muted-foreground font-medium">Total students:</span>
                  {editingCount === "total" ? (
                    <input
                      type="number"
                      min={0}
                      autoFocus
                      className="field !h-7 !w-20 !py-0 text-center font-bold"
                      value={ed.total}
                      onChange={(e) => handleTotalChange(e.target.value)}
                      onBlur={() => setEditingCount(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingCount(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="rounded px-2 py-0.5 font-bold text-foreground hover:bg-muted transition-colors"
                      title="क्लिक गरेर कुल विद्यार्थी संख्या सच्याउनुहोस् · Click to edit total students"
                      onClick={() => setEditingCount("total")}
                    >
                      {ed.total} <span className="text-[11px] font-normal text-muted-foreground">✎</span>
                    </button>
                  )}
                  {classStuCount > 0 && ed.total !== classStuCount && (
                    <button
                      type="button"
                      className="text-[11px] text-primary underline ml-1"
                      title="कक्षामा दर्ता भएको कुल विद्यार्थी संख्या राख्नुहोस्"
                      onClick={() => {
                        const nextTotal = classStuCount;
                        const nextPresent = manualCount
                          ? Math.min(nextTotal, pCount)
                          : Math.max(0, nextTotal - realAbsent.length);
                        set({ total: nextTotal, present: nextPresent });
                      }}
                    >
                      ↺ ({classStuCount})
                    </button>
                  )}
                </div>

                {/* Present Count: click to enter custom number, auto-updates Absent count */}
                <div className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-card px-3 py-1.5 shadow-sm">
                  <span className="text-muted-foreground font-medium">Present count:</span>
                  {editingCount === "present" ? (
                    <input
                      type="number"
                      min={0}
                      max={Math.max(ed.total, pCount)}
                      autoFocus
                      className="field !h-7 !w-20 !py-0 text-center font-bold text-primary"
                      value={pCount}
                      onChange={(e) => handlePresentChange(e.target.value)}
                      onBlur={() => setEditingCount(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingCount(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="rounded px-2 py-0.5 font-bold text-primary hover:bg-primary/10 transition-colors"
                      title="क्लिक गरेर उपस्थित संख्या राख्नुहोस् (अनुपस्थित संख्या स्वतः मिल्नेछ) · Click to set Present count"
                      onClick={() => setEditingCount("present")}
                    >
                      {pCount} <span className="text-[11px] font-normal text-muted-foreground">✎</span>
                    </button>
                  )}
                </div>

                {/* Absent Count: automatically shows remaining (Total - Present), also clickable */}
                <div className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-card px-3 py-1.5 shadow-sm">
                  <span className="text-muted-foreground font-medium">Absent count:</span>
                  {editingCount === "absent" ? (
                    <input
                      type="number"
                      min={0}
                      max={Math.max(ed.total, aCount)}
                      autoFocus
                      className="field !h-7 !w-20 !py-0 text-center font-bold text-destructive"
                      value={aCount}
                      onChange={(e) => handleAbsentCountChange(e.target.value)}
                      onBlur={() => setEditingCount(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingCount(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="rounded px-2 py-0.5 font-bold text-destructive hover:bg-destructive/10 transition-colors"
                      title="क्लिक गरेर अनुपस्थित संख्या सच्याउनुहोस् · Click to edit Absent count"
                      onClick={() => setEditingCount("absent")}
                    >
                      {aCount} <span className="text-[11px] font-normal text-muted-foreground">✎</span>
                    </button>
                  )}
                </div>
              </div>

              {stu.length > 0 && manualCount && pCount !== Math.max(0, ed.total - realAbsent.length) && (
                <button
                  type="button"
                  className="btn-soft !py-1 !px-2.5 text-xs"
                  onClick={syncCountWithStudentAttendance}
                  title="तलको विद्यार्थी हाजिरी अनुसार संख्या मिलाउनुहोस्"
                >
                  ↺ हाजिरी नाम अनुसार संख्या मिलाउनुहोस् ({Math.max(0, ed.total - realAbsent.length)} P / {realAbsent.length} A)
                </button>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground">
              * माथिको <b>Present count ({pCount})</b> शिक्षकको मासिक प्रतिवेदन (Monthly Report) मा गणना हुन्छ।
            </div>

            {/* Individual Student Attendance Section */}
            <div className="border-t border-border/70 pt-2.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="lbl !mb-0 text-sm font-bold text-foreground">
                  Attendance · विद्यार्थी हाजिरी
                </div>
                {stu.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    अनुपस्थित विद्यार्थीको नाममा क्लिक गर्नुहोस् (विद्यार्थी प्रतिवेदनमा गणना हुने · Marked absent:{" "}
                    <b className="text-destructive">{realAbsent.length}</b>)
                  </span>
                )}
              </div>

              {stu.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {stu.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        realAbsent.includes(s)
                          ? "rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground line-through shadow-sm"
                          : "chip"
                      }
                      onClick={() => handleToggleStudentAbsent(s)}
                    >
                      {i + 1}. {s}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  यस कक्षामा विद्यार्थीको नामावली राखिएको छैन। माथिको Present / Absent count बाट संख्या टिप्न सक्नुहुन्छ वा Setup / Students बाट नामावली थप्न सक्नुहुन्छ।
                </p>
              )}
            </div>

            {/* Attendance Remarks */}
            <div className="pt-1">{area("reasons", "Remarks")}</div>
          </div>

          <div>
            <div className="lbl">Class activities (short codes for monthly report) · शिक्षण क्रियाकलाप कोड</div>
            <div className="flex flex-wrap gap-1.5">
              {CODES.map(([c, l]) => (
                <button
                  key={c}
                  type="button"
                  className={ed.codes.includes(c) ? "chip-on" : "chip"}
                  onClick={() => set({ codes: toggle(ed.codes, c) })}
                >
                  {c} · {l}
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible Teaching Details Section to prevent form clutter */}
          <div className="rounded-xl border border-border/80 bg-background/60 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-sm font-bold text-foreground"
              onClick={() => setShowMoreDetails((v) => !v)}
            >
              <span>
                {showMoreDetails ? "▼" : "▶"} शिक्षण विधि, विद्यार्थी क्रियाकलाप र मूल्याङ्कन (Methods, Activities & Evaluation)
              </span>
              <span className="text-xs font-normal text-primary">
                {showMoreDetails ? "संक्षिप्त बनाउनुहोस् (Collapse)" : "विस्तृत लेख्नुहोस् (Expand)"}
              </span>
            </button>
            {showMoreDetails && (
              <div className="mt-3 grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
                {area("methods", "Methods & methodology used")}
                {area("studentActs", "Students' activities")}
                {area("feedback", "Students' feedback")}
                {area("evaluation", "Evaluation done")}
              </div>
            )}
          </div>

          {/* Bottom Special Remark with "Include in monthly report?" checkbox */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="lbl !mb-0 text-sm font-bold text-foreground">
                Special remark · विशेष कैफियत
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 bg-card px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={!!ed.remarkInMonthly}
                  onChange={(e) => set({ remarkInMonthly: e.target.checked })}
                />
                <span>Include in monthly report?</span>
              </label>
            </div>
            <textarea
              className="field min-h-16"
              value={ed.remarks || ""}
              placeholder="विशेष कैफियत (मासिक प्रतिवेदनको Remarks कोलममा देखाउन दायाँको बक्समा टिक लगाउनुहोस्)"
              onChange={(e) => set({ remarks: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={save}>
              Save · सुरक्षित गर्नुहोस्
            </button>
            <button className="btn-soft" onClick={() => setEd(null)}>
              Cancel
            </button>
            {ed.id && (
              <button
                className="btn-danger ml-auto"
                onClick={() => {
                  if (confirm("Do you want to permanently delete this?")) {
                    updateData((d) => {
                      d.diary = d.diary.filter((x) => x.id !== ed.id);
                    });
                    setEd(null);
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            📖 Entries · दैनिक डायरी अभिलेखहरू ({list.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="🔍 पाठ वा मिति खोज्नुहोस्..."
              className="field !h-9 !w-48 text-xs"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            <div className="w-56">
              <ClassSelect all value={fc} onChange={setFc} />
            </div>
          </div>
        </div>
        <ul className="divide-y divide-border/70">
          {list.map((d) => {
            const c = data.classes.find((x) => x.id === d.classId);
            const p = presentCountOf(d);
            const a = absentCountOf(d);
            return (
              <li
                key={d.id}
                className="cursor-pointer rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/50"
                onClick={() => openExistingEntry(d)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b>
                      <Dt d={d.date} />
                    </b>{" "}
                    · <span className="font-semibold text-primary">{c?.name}</span> · {c?.subject} —{" "}
                    <span className="font-medium">{d.topic || "—"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="chip !py-0.5">
                      Present: <b className="text-primary">{p}</b>/{d.total} (A: <b className="text-destructive">{a}</b>)
                    </span>
                    <span className="chip !py-0.5">{d.lh} LH</span>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {d.codes.length > 0 && <span>क्रियाकलाप: {d.codes.join(", ")}</span>}
                  {d.reasons && <span>· Remarks: {d.reasons}</span>}
                  {d.remarks && (
                    <span className={d.remarkInMonthly ? "font-semibold text-primary" : ""}>
                      · Special remark: {d.remarks} {d.remarkInMonthly ? "(✓ Monthly Report)" : ""}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {!list.length && (
            <li className="py-8 text-center text-sm text-muted-foreground">
              कुनै दैनिक डायरी इन्ट्री भेटिएन (No entries found).
            </li>
          )}
        </ul>
      </section>
    </Page>
  );
}
