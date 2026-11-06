import { useEffect, useMemo, useState } from "react";
import { PrintBtn, PrintHead, Signatures } from "@/components/app/ui";
import { useTeacher } from "@/lib/store";
import { todayBs, fmtBs } from "@/lib/bs";
import * as C from "@/lib/campus";
import * as D from "@/lib/dm";

export type ObservationLog = {
  id: string;
  deptId: string;
  year: string;
  date: string;
  teacherId?: string;
  teacherName: string;
  className: string;
  subject: string;
  topic: string;
  method: string;
  participation: string;
  strengths: string;
  suggestions: string;
  observerName: string;
  observerRole: string;
  score?: number;
};

export type MonthlyReviewNote = {
  teacherId: string;
  month: string;
  remarks: string;
  status: "reviewed" | "pending" | "action_needed";
  updatedAt: string;
};

const METHODS = [
  "व्याख्यान (Lecture)",
  "छलफल तथा प्रश्नोत्तर (Discussion)",
  "प्रविधि तथा प्रोजेक्टर (ICT / Multimedia)",
  "समूह कार्य (Group Work / Peer Learning)",
  "प्रयोगात्मक / अभ्यास (Practical / Problem Solving)",
  "अन्य (Other)",
];

const PARTICIPATION_LEVELS = [
  "उत्कृष्ट (High / Highly Active)",
  "सन्तोषजनक (Good / Satisfactory)",
  "मध्यम (Average / Passive)",
  "सुधार आवश्यक (Needs Improvement)",
];

const BS_MONTHS_NAMES = [
  "Baishakh · बैशाख",
  "Jestha · जेठ",
  "Ashadh · असार",
  "Shrawan · साउन",
  "Bhadra · भदौ",
  "Ashwin · असोज",
  "Kartik · कार्तिक",
  "Mangsir · मंसिर",
  "Poush · पुस",
  "Magh · माघ",
  "Falgun · फागुन",
  "Chaitra · चैत",
];

export function SupervisionTab({
  dept,
  deptName,
  year,
  admin,
  canManage,
}: {
  dept: string;
  deptName: string;
  year: string;
  admin: boolean;
  canManage: boolean;
}) {
  const { profile } = useTeacher();
  const lk = C.useLookup();
  const [subTab, setSubTab] = useState<"observations" | "reviews">("observations");
  const [logs, setLogs] = useState<ObservationLog[]>([]);
  const [teachers, setTeachers] = useState<D.DeptTeacher[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, MonthlyReviewNote>>({});
  const [selectedMonth, setSelectedMonth] = useState("7"); // Default: Kartik
  const [isEditing, setIsEditing] = useState(false);
  const [singlePrint, setSinglePrint] = useState<ObservationLog | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<ObservationLog>>({
    date: todayBs(),
    teacherName: "",
    className: "",
    subject: "",
    topic: "",
    method: METHODS[0],
    participation: PARTICIPATION_LEVELS[0],
    strengths: "",
    suggestions: "",
    observerName: profile?.name || "",
    observerRole: admin ? "Campus Administration" : "Head of Department",
  });

  const storageKey = useMemo(() => `shikshak-dept-supervision-${dept}-${year}`, [dept, year]);
  const reviewStorageKey = useMemo(() => `shikshak-dept-monthly-reviews-${dept}-${year}`, [dept, year]);

  // Load department teachers & local data
  useEffect(() => {
    if (!dept) return;
    void D.loadDeptTeachers(dept, deptName).then((list) => {
      setTeachers(list || []);
    });

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLogs(parsed);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    }

    try {
      const rawRev = localStorage.getItem(reviewStorageKey);
      if (rawRev) {
        const parsedRev = JSON.parse(rawRev);
        if (parsedRev && typeof parsedRev === "object") setReviewNotes(parsedRev);
      } else {
        setReviewNotes({});
      }
    } catch {
      setReviewNotes({});
    }
  }, [dept, deptName, storageKey, reviewStorageKey]);

  const saveLogs = (newLogs: ObservationLog[]) => {
    setLogs(newLogs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newLogs));
    } catch {
      /* ignore */
    }
  };

  const saveReviewNotes = (newNotes: Record<string, MonthlyReviewNote>) => {
    setReviewNotes(newNotes);
    try {
      localStorage.setItem(reviewStorageKey, JSON.stringify(newNotes));
    } catch {
      /* ignore */
    }
  };

  const deptClasses = lk.classes.filter((c) => c.department_id === dept);

  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacherName || !form.topic) {
      alert("कृपया शिक्षकको नाम र पाठ शीर्षक भर्नुहोस्।");
      return;
    }

    if (form.id) {
      // Edit existing
      const updated = logs.map((l) => (l.id === form.id ? ({ ...l, ...form } as ObservationLog) : l));
      saveLogs(updated);
    } else {
      // Add new
      const newEntry: ObservationLog = {
        id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        deptId: dept,
        year,
        date: form.date || todayBs(),
        teacherId: form.teacherId || "",
        teacherName: form.teacherName || "",
        className: form.className || "",
        subject: form.subject || "",
        topic: form.topic || "",
        method: form.method || METHODS[0],
        participation: form.participation || PARTICIPATION_LEVELS[0],
        strengths: form.strengths || "",
        suggestions: form.suggestions || "",
        observerName: form.observerName || profile?.name || "",
        observerRole: form.observerRole || "Head of Department",
      };
      saveLogs([newEntry, ...logs]);
    }

    setIsEditing(false);
    setForm({
      date: todayBs(),
      teacherName: "",
      className: "",
      subject: "",
      topic: "",
      method: METHODS[0],
      participation: PARTICIPATION_LEVELS[0],
      strengths: "",
      suggestions: "",
      observerName: profile?.name || "",
      observerRole: admin ? "Campus Administration" : "Head of Department",
    });
  };

  const handleDeleteObservation = (id: string) => {
    if (!confirm("के तपाईं यो कक्षा अवलोकन अभिलेख हटाउन निश्चित हुनुहुन्छ?")) return;
    saveLogs(logs.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tabs / View Switcher */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="inline-flex rounded-lg bg-secondary p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === "observations" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setSubTab("observations");
              setSinglePrint(null);
            }}
          >
            📋 Class Observation Logs · कक्षा अवलोकन अभिलेख ({logs.length})
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === "reviews" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setSubTab("reviews");
              setSinglePrint(null);
            }}
          >
            🔍 Monthly Report Review · मासिक प्रतिवेदन समीक्षा
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === "observations" && canManage && !isEditing && (
            <button
              type="button"
              className="btn btn-primary !py-1 !px-3 text-xs"
              onClick={() => {
                setForm({
                  date: todayBs(),
                  teacherName: teachers[0]?.name || "",
                  className: deptClasses[0]?.name || "",
                  subject: "",
                  topic: "",
                  method: METHODS[0],
                  participation: PARTICIPATION_LEVELS[0],
                  strengths: "",
                  suggestions: "",
                  observerName: profile?.name || "",
                  observerRole: admin ? "Campus Administration" : "Head of Department",
                });
                setIsEditing(true);
                setSinglePrint(null);
              }}
            >
              + नयाँ कक्षा अवलोकन (Add Observation)
            </button>
          )}
          <PrintBtn />
        </div>
      </div>

      {/* VIEW 1: OBSERVATIONS */}
      {subTab === "observations" && (
        <>
          {/* Edit / Create Form Modal/Panel */}
          {isEditing && (
            <section className="no-print panel mb-4 rounded-xl border border-primary/40 bg-secondary/20 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-bold text-base text-primary">
                  {form.id ? "कक्षा अवलोकन सम्पादन गर्नुहोस् (Edit Observation)" : "नयाँ कक्षा अवलोकन फारम (New Class Observation)"}
                </h3>
                <button type="button" className="btn-soft !py-1 !px-2 text-xs" onClick={() => setIsEditing(false)}>
                  ✕ बन्द गर्नुहोस् (Cancel)
                </button>
              </div>

              <form onSubmit={handleSaveObservation} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="lbl">मिति (BS Date) *</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="YYYY-MM-DD"
                    value={form.date || todayBs()}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">शिक्षकको नाम (Teacher Name) *</label>
                  {teachers.length > 0 ? (
                    <select
                      className="field"
                      value={form.teacherName || ""}
                      onChange={(e) => {
                        const matched = teachers.find((t) => t.name === e.target.value);
                        setForm({
                          ...form,
                          teacherName: e.target.value,
                          teacherId: matched?.user_id || "",
                        });
                      }}
                      required
                    >
                      <option value="">— शिक्षक छान्नुहोस् —</option>
                      {teachers.map((t) => (
                        <option key={t.user_id} value={t.name}>
                          {t.name} ({t.designation || "शिक्षक"})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="field"
                      placeholder="शिक्षकको नाम"
                      value={form.teacherName || ""}
                      onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="lbl">कक्षा (Class)</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="e.g. Bachelor 1st Year / MBS III"
                    value={form.className || ""}
                    onChange={(e) => setForm({ ...form, className: e.target.value })}
                  />
                </div>

                <div>
                  <label className="lbl">विषय (Subject)</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="e.g. Research Methodology / Business Environment"
                    value={form.subject || ""}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="lbl">पाठ्यांश / पाठ शीर्षक (Lesson Topic) *</label>
                  <input
                    type="text"
                    className="field font-medium"
                    placeholder="e.g. Concept and Meaning of Research"
                    value={form.topic || ""}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">प्रयोग गरिएको मुख्य शिक्षण विधि (Methodology)</label>
                  <select
                    className="field"
                    value={form.method || METHODS[0]}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="lbl">विद्यार्थी सहभागिता (Student Engagement)</label>
                  <select
                    className="field"
                    value={form.participation || PARTICIPATION_LEVELS[0]}
                    onChange={(e) => setForm({ ...form, participation: e.target.value })}
                  >
                    {PARTICIPATION_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="lbl">सबल पक्षहरू / राम्रा अभ्यासहरू (Major Strengths Observed)</label>
                  <textarea
                    rows={2}
                    className="field"
                    placeholder="कक्षा सञ्चालनका क्रममा देखिएका सकारात्मक बुँदाहरू..."
                    value={form.strengths || ""}
                    onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="lbl">सुधार गर्नुपर्ने पक्ष तथा पृष्ठपोषण (Suggestions & Action Points)</label>
                  <textarea
                    rows={2}
                    className="field"
                    placeholder="शिक्षकलाई दिइएको आवश्यक सुझाव, सल्लाह वा सुधारका बुँदाहरू..."
                    value={form.suggestions || ""}
                    onChange={(e) => setForm({ ...form, suggestions: e.target.value })}
                  />
                </div>

                <div>
                  <label className="lbl">पर्यवेक्षकको नाम (Observer Name)</label>
                  <input
                    type="text"
                    className="field"
                    value={form.observerName || profile?.name || ""}
                    onChange={(e) => setForm({ ...form, observerName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="lbl">पद / भूमिका (Designation / Role)</label>
                  <input
                    type="text"
                    className="field"
                    value={form.observerRole || "Head of Department"}
                    onChange={(e) => setForm({ ...form, observerRole: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                  <button type="button" className="btn-soft" onClick={() => setIsEditing(false)}>
                    रद्द गर्नुहोस् (Cancel)
                  </button>
                  <button type="submit" className="btn">
                    सुरक्षित गर्नुहोस् (Save Observation)
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Single Printable Sheet */}
          {singlePrint && (
            <section className="panel mb-4">
              <div className="no-print mb-3 flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-xs text-primary">अवलोकन फारम मुद्रण पूर्वावलोकन (Print Preview)</span>
                <div className="flex gap-2">
                  <button type="button" className="btn-soft !py-1 !px-2 text-xs" onClick={() => window.print()}>
                    प्रिन्ट गर्नुहोस् (Print)
                  </button>
                  <button type="button" className="btn-soft !py-1 !px-2 text-xs" onClick={() => setSinglePrint(null)}>
                    ✕ बन्द गर्नुहोस्
                  </button>
                </div>
              </div>

              <PrintHead title={`Class Observation Report — ${deptName || "Department"}`} />

              <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 border-b border-border pb-2.5">
                <div>विभाग: <b>{deptName || "—"}</b></div>
                <div>शैक्षिक सत्र: <b>{year}</b></div>
                <div>अवलोकन मिति: <b>{fmtBs(singlePrint.date)}</b></div>
                <div>पर्यवेक्षक: <b>{singlePrint.observerName}</b> ({singlePrint.observerRole})</div>
              </div>

              <table className="rtable text-xs mb-4">
                <tbody>
                  <tr>
                    <td className="w-48 font-medium">शिक्षकको नाम (Teacher)</td>
                    <td className="font-bold text-primary">{singlePrint.teacherName}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">कक्षा तथा विषय (Class & Subject)</td>
                    <td>{singlePrint.className || "—"} · {singlePrint.subject || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">पाठ्यांश / पाठ शीर्षक (Topic)</td>
                    <td className="font-semibold">{singlePrint.topic}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">शिक्षण विधि (Methodology)</td>
                    <td>{singlePrint.method}</td>
                  </tr>
                  <tr>
                    <td className="font-medium">विद्यार्थी सहभागिता (Participation)</td>
                    <td>{singlePrint.participation}</td>
                  </tr>
                  <tr>
                    <td className="font-medium align-top">सबल पक्षहरू (Strengths)</td>
                    <td className="whitespace-pre-line">{singlePrint.strengths || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-medium align-top">सुझाव तथा कार्ययोजना (Suggestions)</td>
                    <td className="whitespace-pre-line text-foreground font-medium">{singlePrint.suggestions || "—"}</td>
                  </tr>
                </tbody>
              </table>

              <Signatures
                roles={[
                  ["सम्बन्धित शिक्षक (Teacher Observed)", singlePrint.teacherName],
                  ["पर्यवेक्षक / विभागीय प्रमुख (Observer / HOD)", singlePrint.observerName],
                ]}
              />
            </section>
          )}

          {/* List Table */}
          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-primary">कक्षा अवलोकन अभिलेख (Class Observation Logs)</h3>
                <p className="text-xs text-muted-foreground">
                  विभागका शिक्षकहरूको कक्षा शिक्षण अवलोकन, सबल पक्ष र सुधारका सुझावहरूको आधिकारिक अभिलेख
                </p>
              </div>
              <span className="chip-on text-xs">कुल अभिलेख: {logs.length}</span>
            </div>

            {logs.length === 0 ? (
              <div className="rounded-lg border border-border bg-secondary/30 p-6 text-center text-xs text-muted-foreground">
                <p className="font-medium">यो विभागमा अहिलेसम्म कुनै कक्षा अवलोकन अभिलेख राखिएको छैन।</p>
                {canManage && (
                  <p className="mt-1">
                    माथिको <b>+ नयाँ कक्षा अवलोकन</b> बटन थिचेर पहिलो अवलोकन अभिलेख भर्नुहोस्।
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="rtable w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left">मिति</th>
                      <th className="p-2 text-left">शिक्षकको नाम</th>
                      <th className="p-2 text-left">कक्षा / विषय</th>
                      <th className="p-2 text-left">पाठ शीर्षक</th>
                      <th className="p-2 text-left">शिक्षण विधि</th>
                      <th className="p-2 text-left">सहभागिता</th>
                      <th className="p-2 text-left">सुझाव तथा पृष्ठपोषण</th>
                      <th className="no-print p-2 text-right">कार्य</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/40 transition">
                        <td className="p-2 whitespace-nowrap font-medium">{fmtBs(l.date)}</td>
                        <td className="p-2 font-bold text-primary whitespace-nowrap">{l.teacherName}</td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">
                          {l.className} {l.subject ? `(${l.subject})` : ""}
                        </td>
                        <td className="p-2 font-medium max-w-44 truncate">{l.topic}</td>
                        <td className="p-2 whitespace-nowrap">{l.method.split(" ")[0]}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span
                            className={
                              l.participation.includes("High") || l.participation.includes("उत्कृष्ट")
                                ? "chip-on"
                                : "chip"
                            }
                          >
                            {l.participation.split(" ")[0]}
                          </span>
                        </td>
                        <td className="p-2 max-w-56 truncate text-muted-foreground">{l.suggestions || "—"}</td>
                        <td className="no-print p-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="btn-soft !py-0.5 !px-2 text-[11px]"
                              onClick={() => setSinglePrint(l)}
                              title="फारम हेर्नुहोस् तथा प्रिन्ट गर्नुहोस्"
                            >
                              View / Print
                            </button>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  className="btn-soft !py-0.5 !px-2 text-[11px]"
                                  onClick={() => {
                                    setForm(l);
                                    setIsEditing(true);
                                    setSinglePrint(null);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger !py-0.5 !px-1.5 text-[11px]"
                                  onClick={() => handleDeleteObservation(l.id)}
                                >
                                  ×
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* VIEW 2: MONTHLY REPORT REVIEW */}
      {subTab === "reviews" && (
        <section className="panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-base text-primary">मासिक / आवधिक प्रतिवेदन समीक्षा (Monthly Report Review)</h3>
              <p className="text-xs text-muted-foreground">
                विभागीय शिक्षकहरूको मासिक शिक्षण प्रगति, कार्यघन्टा र डायरी विवरणको अनुगमन तथा विभागीय समीक्षा टिप्पणी
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground">महिना छान्नुहोस्:</label>
              <select
                className="field !w-auto text-xs font-bold"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {BS_MONTHS_NAMES.map((m, idx) => (
                  <option key={idx + 1} value={String(idx + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="rtable w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2.5 text-left">क्र.सं.</th>
                  <th className="p-2.5 text-left">शिक्षकको नाम तथा पद</th>
                  <th className="p-2.5 text-left">विभाग</th>
                  <th className="p-2.5 text-left">समीक्षा स्थिति (Status)</th>
                  <th className="p-2.5 text-left">विभागीय प्रमुखको समीक्षा / निर्देशन (Remarks & Feedback)</th>
                  {canManage && <th className="no-print p-2.5 text-right">कार्य</th>}
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      यो विभागका शिक्षकहरूको सूची प्राप्त भएन।
                    </td>
                  </tr>
                ) : (
                  teachers.map((t, idx) => {
                    const noteKey = `${t.user_id}-${selectedMonth}`;
                    const currentNote = reviewNotes[noteKey] || {
                      teacherId: t.user_id,
                      month: selectedMonth,
                      remarks: "",
                      status: "pending",
                      updatedAt: "",
                    };

                    return (
                      <tr key={t.user_id} className="hover:bg-muted/30 transition">
                        <td className="p-2.5 text-muted-foreground font-medium">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-foreground">
                          <div>{t.name}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">{t.designation || "शिक्षक"}</div>
                        </td>
                        <td className="p-2.5 text-muted-foreground">{t.dept || deptName}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span
                            className={
                              currentNote.status === "reviewed"
                                ? "chip-on"
                                : currentNote.status === "action_needed"
                                ? "chip border-destructive text-destructive font-bold"
                                : "chip"
                            }
                          >
                            {currentNote.status === "reviewed"
                              ? "समीक्षा सम्पन्न (Reviewed)"
                              : currentNote.status === "action_needed"
                              ? "सुधार आवश्यक (Action Needed)"
                              : "प्रतीक्षारत (Pending Review)"}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {canManage ? (
                            <textarea
                              rows={1}
                              className="field !text-xs w-full min-h-8"
                              placeholder="विभागीय प्रमुखको टिप्पणी वा निर्देशन लेख्नुहोस्..."
                              value={currentNote.remarks || ""}
                              onChange={(e) => {
                                saveReviewNotes({
                                  ...reviewNotes,
                                  [noteKey]: {
                                    ...currentNote,
                                    remarks: e.target.value,
                                    updatedAt: todayBs(),
                                  },
                                });
                              }}
                            />
                          ) : (
                            <span className="text-muted-foreground">{currentNote.remarks || "—"}</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="no-print p-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className={`btn-soft !py-1 !px-2 text-[11px] ${
                                currentNote.status === "reviewed" ? "!border-primary !text-primary font-bold" : ""
                              }`}
                              onClick={() => {
                                const nextStatus =
                                  currentNote.status === "reviewed"
                                    ? "action_needed"
                                    : currentNote.status === "action_needed"
                                    ? "pending"
                                    : "reviewed";
                                saveReviewNotes({
                                  ...reviewNotes,
                                  [noteKey]: {
                                    ...currentNote,
                                    status: nextStatus,
                                    updatedAt: todayBs(),
                                  },
                                });
                              }}
                              title="स्थिति परिवर्तन गर्नुहोस्"
                            >
                              {currentNote.status === "reviewed" ? "✓ स्वीकृत" : "समीक्षा चिन्ह लगाउनुहोस्"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border/80 bg-secondary/30 p-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>
              💡 <b>सुझाव:</b> विभागका शिक्षकहरूले पेश गरेका मासिक कार्यसम्पादन प्रतिवेदनहरू समीक्षा गरी माथि टिप्पणी लेख्न र स्वीकृत गर्न सक्नुहुन्छ।
            </span>
            <span className="text-[11px]">अद्यावधिक मिति: {todayBs()}</span>
          </div>
        </section>
      )}
    </div>
  );
}
