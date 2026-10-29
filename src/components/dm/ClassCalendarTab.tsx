import { useCallback, useEffect, useState } from "react";
import { PrintBtn, PrintHead } from "@/components/app/ui";
import { useTeacher } from "@/lib/store";
import * as C from "@/lib/campus";
import * as D from "@/lib/dm";

const statusInfo = (s: string) => D.PLAN_STATUS.find((x) => x.k === s) ?? { k: s, en: s, ne: s };

export function ClassCalendarTab({
  dept,
  deptName,
  year,
  years = [],
  onYearChange,
  admin,
  canManage,
  onChanged,
}: {
  dept: string;
  deptName: string;
  year: string;
  years?: string[];
  onYearChange?: (y: string) => void;
  admin: boolean;
  canManage: boolean;
  onChanged: () => void;
}) {
  const { profile } = useTeacher();
  const lk = C.useLookup();
  const [classId, setClassId] = useState("");
  const [cal, setCal] = useState<D.ClassAcademicCalendar | null>(null);
  const [allCals, setAllCals] = useState<D.ClassAcademicCalendar[]>([]);
  const [annualEvents, setAnnualEvents] = useState<D.CampusAnnualEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [startMonth, setStartMonth] = useState(1); // Baishakh (default)
  const [endMonth, setEndMonth] = useState(12);    // Chaitra (default)
  const [particulars, setParticulars] = useState<D.CalendarParticularRow[]>([]);
  const [approvalNote, setApprovalNote] = useState("");
  const [copySourceId, setCopySourceId] = useState("");

  const deptClasses = lk.classes.filter((c) => c.department_id === dept);

  // Auto-select first class
  useEffect(() => {
    if (!classId && deptClasses.length > 0 && deptClasses[0]) {
      setClassId(deptClasses[0].id);
    }
  }, [deptClasses, classId]);

  const load = useCallback(async () => {
    if (!dept || !year) return;
    setLoading(true);
    setErr("");
    const [cList, evList] = await Promise.all([
      D.loadAllClassCalendars(dept, year),
      D.loadCampusAnnualEvents(),
    ]);
    setAllCals(cList || []);
    setAnnualEvents(evList || []);

    if (classId) {
      const single = await D.loadClassCalendar(dept, year, classId);
      if (single.ok && single.data) {
        setCal(single.data);
        setStartMonth(single.data.start_month || 1);
        setEndMonth(single.data.end_month || 12);
        setParticulars(single.data.particulars || []);
        setApprovalNote(single.data.approval_note || "");
      } else {
        setCal(null);
        setStartMonth(1);
        setEndMonth(12);
        setParticulars(
          D.DEFAULT_MATRIX_PARTICULARS.map((p, idx) => ({
            id: `row-${idx}-${Date.now()}`,
            ...p,
            values: { ...p.values },
          }))
        );
      }
    }
    setLoading(false);
  }, [dept, year, classId]);

  useEffect(() => {
    void load();
    setIsEditing(false);
    setNote("");
  }, [load]);

  const currentMonths = D.buildAcademicMonths(startMonth, endMonth);
  const currentClassName = deptClasses.find((c) => c.id === classId)?.name || classId;

  const handleMonthRangeChange = (start: number, end: number) => {
    setStartMonth(start);
    setEndMonth(end);
    if (canManage && !isEditing) {
      setIsEditing(true);
      setNote("महिना दायरा परिवर्तन भयो। आवश्यक भए विवरण भरी \"Save changes\" थिच्नुहोस्।");
    }
  };

  const updateCellValue = (rowId: string, monthKey: string, val: string) => {
    setParticulars((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const newValues = { ...(r.values || {}), [monthKey]: val };
        let remarks = r.remarks;
        if (r.isTotalDays || r.isTeachingDays) {
          const sum = D.calcRowAutoSum({ ...r, values: newValues }, currentMonths);
          remarks = sum > 0 ? String(sum) : "";
        }
        return { ...r, values: newValues, remarks };
      })
    );
  };

  const updateSpanText = (rowId: string, text: string) => {
    setParticulars((prev) => prev.map((r) => (r.id === rowId ? { ...r, spanText: text } : r)));
  };

  const updateRowRemarks = (rowId: string, text: string) => {
    setParticulars((prev) => prev.map((r) => (r.id === rowId ? { ...r, remarks: text } : r)));
  };

  const toggleRowType = (rowId: string) => {
    setParticulars((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, type: r.type === "monthly" ? "span" : "monthly" } : r))
    );
  };

  const addCustomRow = () => {
    const title = prompt("New row title · नयाँ बुँदाको नाम (उदा. Sports Week / खेलकुद सप्ताह):");
    if (!title?.trim()) return;
    setParticulars((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        title: title.trim(),
        type: "monthly",
        values: {},
        spanText: "",
        remarks: "",
      },
    ]);
  };

  const deleteRow = (rowId: string) => {
    setParticulars((prev) => prev.filter((r) => r.id !== rowId));
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    setParticulars((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[idx]!;
      next[idx] = next[target]!;
      next[target] = temp;
      return next;
    });
  };

  // Import vacation/exam dates from Campus Annual Calendar automatically
  const importCampusHolidays = () => {
    if (!annualEvents.length) {
      alert("No campus annual events found. Admin can add them in Setup → Campus Annual Calendar.");
      return;
    }
    let count = 0;
    setParticulars((prev) =>
      prev.map((row) => {
        const titleLower = row.title.toLowerCase();
        const matched = annualEvents.filter((ev) => {
          const evLower = ev.title.toLowerCase();
          const typeLower = ev.event_type.toLowerCase();
          return evLower.includes(titleLower) || titleLower.includes(evLower) || titleLower.includes(typeLower);
        });
        if (!matched.length) return row;
        const newValues = { ...(row.values || {}) };
        for (const ev of matched) {
          const fromM = Number(ev.from_date.slice(5, 7)); // BS month 1-12
          const fromD = Number(ev.from_date.slice(8, 10));
          const toD = ev.to_date ? Number(ev.to_date.slice(8, 10)) : null;
          const text = toD && toD !== fromD ? `${fromD}th-${toD}th` : `${fromD}th`;
          if (!newValues[String(fromM)]) {
            newValues[String(fromM)] = text;
            count++;
          }
        }
        return { ...row, values: newValues };
      })
    );
    setNote(`Imported dates for ${count} month slot(s) from Campus Annual Calendar.`);
  };

  const copyFromOther = () => {
    const src = allCals.find((c) => c.id === copySourceId);
    if (!src) return;
    setStartMonth(src.start_month || 7);
    setEndMonth(src.end_month || 4);
    setParticulars(
      (src.particulars || []).map((p, i) => ({
        ...p,
        id: `copied-${i}-${Date.now()}`,
        values: { ...(p.values || {}) },
      }))
    );
    setNote(`Copied particulars & month layout from "${src.class_name}". Adjust dates and save.`);
    setIsEditing(true);
  };

  const save = async (newStatus: "draft" | "submitted" | "approved" = cal?.status || "draft") => {
    if (!dept || !year || !classId) return;
    setNote("");
    // Re-calculate auto sums for working & teaching days
    const cleanParticulars = particulars.map((r) => {
      if (r.isTotalDays || r.isTeachingDays) {
        const sum = D.calcRowAutoSum(r, currentMonths);
        return { ...r, remarks: sum > 0 ? String(sum) : r.remarks };
      }
      return r;
    });

    const payload: Omit<D.ClassAcademicCalendar, "id"> & { id?: string } = {
      id: cal?.id,
      department_id: dept,
      academic_year: year,
      class_id: classId,
      class_name: currentClassName,
      start_month: startMonth,
      end_month: endMonth,
      months: currentMonths,
      particulars: cleanParticulars,
      status: newStatus,
      approval_note: approvalNote,
      prepared_name: cal?.prepared_name || profile?.name || "Head of Department",
      approved_name: newStatus === "approved" ? profile?.name || "Campus Chief" : cal?.approved_name || "",
      approved_at: newStatus === "approved" ? new Date().toISOString() : cal?.approved_at || null,
    };

    const res = await D.saveClassCalendar(payload);
    if (res.ok) {
      setCal(res.data);
      setIsEditing(false);
      setNote(
        newStatus === "approved"
          ? "Academic Calendar Approved · शैक्षिक पात्रो प्रमाणित/स्वीकृत भयो।"
          : newStatus === "submitted"
          ? "Submitted to Campus Chief for verification · क्याम्पस प्रमुखसमक्ष प्रमाणीकरणका लागि पेस गरियो।"
          : "Academic calendar saved · शैक्षिक पात्रो सुरक्षित भयो।"
      );
      await load();
      onChanged();
    } else {
      setErr(res.error);
    }
  };

  const st = statusInfo(cal?.status || "draft");
  const isApproved = cal?.status === "approved";

  return (
    <div>
      {note && <p className="no-print mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      {err && <p className="no-print mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}

      {/* Top selector and toolbar */}
      <section className="panel no-print mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="lbl">Academic Year · शैक्षिक सत्र</label>
              {onYearChange && years.length > 0 ? (
                <select
                  className="field !w-auto min-w-32 font-bold"
                  value={year}
                  onChange={(e) => onYearChange(e.target.value)}
                  title="शैक्षिक सत्र परिवर्तन गर्नुहोस्"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="field !w-auto min-w-28 font-bold">{year}</div>
              )}
            </div>

            <div>
              <label className="lbl">Class · कक्षा</label>
              <select
                className="field !w-auto min-w-56"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setIsEditing(false);
                }}
              >
                {!deptClasses.length && <option value="">No classes in this department</option>}
                {deptClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {allCals.some((x) => x.class_id === c.id) ? "✓ (पात्रो बनेको)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Copy from another class calendar */}
            {canManage && allCals.length > 0 && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="lbl">Copy layout from</label>
                  <select
                    className="field !w-auto"
                    value={copySourceId}
                    onChange={(e) => setCopySourceId(e.target.value)}
                  >
                    <option value="">— Select class —</option>
                    {allCals
                      .filter((c) => c.class_id !== classId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.class_name} ({c.status})
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-soft"
                  disabled={!copySourceId}
                  onClick={copyFromOther}
                >
                  Copy · कपी गर्नुहोस्
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PrintBtn />
            {canManage && !isEditing && (
              <button
                type="button"
                className="btn"
                onClick={() => setIsEditing(true)}
              >
                {cal ? "Edit calendar · सम्पादन गर्नुहोस्" : "+ Create calendar · नयाँ पात्रो बनाउनुहोस्"}
              </button>
            )}
            {isEditing && (
              <>
                <button type="button" className="btn" onClick={() => void save()}>
                  Save changes · सुरक्षित गर्नुहोस्
                </button>
                <button
                  type="button"
                  className="btn-soft"
                  onClick={() => {
                    setIsEditing(false);
                    void load();
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Clickable Month Range & Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-foreground">📅 महिना दायरा (Month Range):</span>
            <button
              type="button"
              className={`btn-soft !h-7 !py-0 !px-2.5 text-xs transition-colors ${startMonth === 1 && endMonth === 12 ? "!bg-primary !text-primary-foreground font-bold shadow-sm" : ""}`}
              onClick={() => handleMonthRangeChange(1, 12)}
              title="बैशाख देखि चैत सम्म (१२ महिना - नेपालको शैक्षिक क्यालेन्डर)"
            >
              बैशाख – चैत (Default · १२ महिना)
            </button>
            <button
              type="button"
              className={`btn-soft !h-7 !py-0 !px-2.5 text-xs transition-colors ${startMonth === 7 && endMonth === 4 ? "!bg-primary !text-primary-foreground font-bold shadow-sm" : ""}`}
              onClick={() => handleMonthRangeChange(7, 4)}
              title="कार्तिक देखि साउन सम्म (१० महिना - TU स्नातक प्रथम वर्ष)"
            >
              कार्तिक – साउन (१० महिना · TU)
            </button>
            <button
              type="button"
              className={`btn-soft !h-7 !py-0 !px-2.5 text-xs transition-colors ${startMonth === 8 && endMonth === 6 ? "!bg-primary !text-primary-foreground font-bold shadow-sm" : ""}`}
              onClick={() => handleMonthRangeChange(8, 6)}
              title="मंसिर देखि असोज सम्म (११ महिना)"
            >
              मंसिर – असोज (११ महिना)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">कस्टम:</span>
            <select
              className="field !h-7 !py-0 !w-auto text-xs font-medium"
              value={startMonth}
              onChange={(e) => handleMonthRangeChange(Number(e.target.value), endMonth)}
              title="सुरु महिना छान्नुहोस्"
            >
              {D.BS_MONTH_INFO.map((m) => (
                <option key={m.bsMonth} value={m.bsMonth}>
                  {m.ne} ({m.en})
                </option>
              ))}
            </select>
            <span className="text-muted-foreground font-semibold">देखि</span>
            <select
              className="field !h-7 !py-0 !w-auto text-xs font-medium"
              value={endMonth}
              onChange={(e) => handleMonthRangeChange(startMonth, Number(e.target.value))}
              title="अन्तिम महिना छान्नुहोस्"
            >
              {D.BS_MONTH_INFO.map((m) => (
                <option key={m.bsMonth} value={m.bsMonth}>
                  {m.ne} ({m.en})
                </option>
              ))}
            </select>
            <span className="text-[11px] font-semibold text-primary ml-1">
              ({currentMonths.length} महिना)
            </span>
            {isEditing && (
              <div className="ml-2 flex items-center gap-1 border-l border-border pl-2">
                <button type="button" className="btn-soft !py-1 text-xs" onClick={importCampusHolidays}>
                  Import Holidays
                </button>
                <button type="button" className="btn-soft !py-1 text-xs" onClick={addCustomRow}>
                  + Add Row
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Approval action bar */}
        {cal && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={isApproved ? "chip-on" : "chip"}>
                {st.en} · {st.ne}
              </span>
              {cal.prepared_name && <span>Prepared by: <b>{cal.prepared_name}</b></span>}
              {cal.approved_name && <span>Approved by: <b>{cal.approved_name}</b></span>}
            </div>

            <div className="flex items-center gap-2">
              {canManage && cal.status === "draft" && (
                <button
                  type="button"
                  className="btn !py-1 text-xs"
                  onClick={() => confirm("Submit to Campus Chief for verification?") && void save("submitted")}
                >
                  Submit for Verification · प्रमाणीकरणका लागि पेस गर्नुहोस्
                </button>
              )}
              {admin && cal.status === "submitted" && (
                <>
                  <button
                    type="button"
                    className="btn !py-1 text-xs"
                    onClick={() => confirm("Approve and certify this Academic Calendar?") && void save("approved")}
                  >
                    Approve & Certify · प्रमाणित / स्वीकृत गर्नुहोस्
                  </button>
                  <button
                    type="button"
                    className="btn-danger !py-1 text-xs"
                    onClick={() => confirm("Revert to draft?") && void save("draft")}
                  >
                    Send back to draft
                  </button>
                </>
              )}
              {admin && cal.status === "approved" && (
                <button
                  type="button"
                  className="btn-soft !py-1 text-xs"
                  onClick={() => confirm("Reopen this approved calendar for revisions?") && void save("draft")}
                >
                  Reopen for revision
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MATRIX CALENDAR SHEET (Exact layout of the photo with verified spelling & grammar) */}
      <section className="panel overflow-x-auto">
        <div className="mb-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Tribhuvan University</div>
          <div className="font-display text-2xl font-bold uppercase text-primary">
            {profile?.campus || "MYAGDI MULTIPLE CAMPUS"}
          </div>
          <div className="text-base font-semibold">Academic Calendar · शैक्षिक कार्यतालिका</div>
          <div className="text-sm font-medium text-muted-foreground">{deptName || "Management"}</div>
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between text-sm font-bold">
          <div>{currentClassName}</div>
          <div className="flex items-center gap-1.5">
            <span>Academic Year · शैक्षिक सत्र:</span>
            {onYearChange && years.length > 0 ? (
              <select
                className="no-print field !h-7 !py-0 !w-auto text-xs font-bold"
                value={year}
                onChange={(e) => onYearChange(e.target.value)}
                title="शैक्षिक सत्र परिवर्तन गर्नुहोस्"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            ) : null}
            <span className={onYearChange && years.length > 0 ? "print-only" : ""}>{year}</span>
          </div>
        </div>

        <table className="rtable w-full text-xs">
          <thead>
            <tr>
              <th className="min-w-64 p-2 text-left">
                <div>Particulars \ Months</div>
                <div className="text-[10px] font-normal text-muted-foreground">विवरण \ महिना</div>
              </th>
              {currentMonths.map((m) => (
                <th key={m.bsMonth} className="min-w-16 p-2 text-center">
                  <div>{m.nameEn}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{m.nameNe}</div>
                </th>
              ))}
              <th className="min-w-20 p-2 text-center">
                <div>Remarks</div>
                <div className="text-[10px] font-normal text-muted-foreground">कैफियत</div>
              </th>
              {isEditing && <th className="no-print w-14 p-2 text-center">Action</th>}
            </tr>
          </thead>
          <tbody>
            {particulars.map((row, idx) => {
              const isHighlight = row.isTotalDays || row.isTeachingDays;
              const [enTitle, neTitle] = (row.title || "").split(" · ");
              return (
                <tr key={row.id} className={isHighlight ? "bg-muted/40 font-semibold" : ""}>
                  <td className="p-2 align-middle">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          className="field !h-7 !py-0 text-xs flex-1"
                          value={row.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParticulars((prev) => prev.map((r) => (r.id === row.id ? { ...r, title: val } : r)));
                          }}
                        />
                        <button
                          type="button"
                          className="btn-soft !h-7 !px-1.5 text-[10px]"
                          title="Toggle between monthly columns and full-row span text"
                          onClick={() => toggleRowType(row.id)}
                        >
                          {row.type === "span" ? "Cols" : "Span"}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-foreground">{enTitle || row.title}</div>
                        {neTitle && <div className="text-[10px] text-muted-foreground font-normal">{neTitle}</div>}
                      </div>
                    )}
                  </td>

                  {row.type === "span" ? (
                    <td colSpan={currentMonths.length} className="p-2 text-center italic text-muted-foreground font-medium">
                      {isEditing ? (
                        <input
                          className="field !h-7 !py-0 text-xs w-full text-center"
                          value={row.spanText}
                          placeholder="e.g. As per TU Notice / Within 2 weeks of TU Board Exam Completion"
                          onChange={(e) => updateSpanText(row.id, e.target.value)}
                        />
                      ) : (
                        row.spanText || "—"
                      )}
                    </td>
                  ) : (
                    currentMonths.map((m) => {
                      const val = (row.values && (row.values[String(m.bsMonth)] ?? row.values[m.nameEn])) || "";
                      return (
                        <td key={m.bsMonth} className="p-1.5 text-center align-middle">
                          {isEditing ? (
                            <input
                              className="field !h-7 !w-full !p-0.5 text-center text-xs"
                              value={val}
                              placeholder={isHighlight ? "0" : "—"}
                              onChange={(e) => updateCellValue(row.id, String(m.bsMonth), e.target.value)}
                            />
                          ) : (
                            val || ""
                          )}
                        </td>
                      );
                    })
                  )}

                  <td className="p-2 text-center align-middle font-bold">
                    {isEditing && !isHighlight ? (
                      <input
                        className="field !h-7 !py-0 text-center text-xs"
                        value={row.remarks}
                        onChange={(e) => updateRowRemarks(row.id, e.target.value)}
                      />
                    ) : (
                      row.remarks || ""
                    )}
                  </td>

                  {isEditing && (
                    <td className="no-print p-1 text-center align-middle">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          className="btn-soft !h-6 !w-6 !p-0 text-xs"
                          disabled={idx === 0}
                          onClick={() => moveRow(idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn-soft !h-6 !w-6 !p-0 text-xs"
                          disabled={idx === particulars.length - 1}
                          onClick={() => moveRow(idx, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn-danger !h-6 !w-6 !p-0 text-xs"
                          onClick={() => deleteRow(row.id)}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Signatures matching photo: Head of Department & Campus Chief */}
        <div className="mt-14 flex items-end justify-between px-6 text-center text-xs">
          <div className="w-56 border-t border-foreground pt-1.5">
            <div className="font-bold">({cal?.prepared_name || profile?.hod || profile?.name || "Head of Department"})</div>
            <div className="text-muted-foreground">Head of Department · तयार गर्ने (विभागीय प्रमुख)</div>
          </div>

          <div className="w-56 border-t border-foreground pt-1.5">
            <div className="font-bold">({cal?.approved_name || profile?.chief || "Campus Chief"})</div>
            <div className="text-muted-foreground">Campus Chief · प्रमाणित गर्ने (क्याम्पस प्रमुख)</div>
          </div>
        </div>
      </section>
    </div>
  );
}
