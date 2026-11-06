import { useEffect, useState } from "react";
import { PrintHead, Signatures } from "@/components/app/ui";
import { todayBs, fmtBs } from "@/lib/bs";
import * as C from "@/lib/campus";
import * as D from "@/lib/dm";
import { useTeacher } from "@/lib/store";
import {
  calcGrade,
  calcTotalScore,
  deletePeerObservation,
  getObservationsByObserver,
  loadAllPeerObservations,
  PEER_OBS_CRITERIA,
  savePeerObservation,
  type PeerObservation,
} from "@/lib/peer-obs";

export function PeerObservationSection() {
  const { profile } = useTeacher();
  const lk = C.useLookup();
  const [logs, setLogs] = useState<PeerObservation[]>([]);
  const [deptTeachers, setDeptTeachers] = useState<D.DeptTeacher[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [singlePrint, setSinglePrint] = useState<PeerObservation | null>(null);

  // Form State
  const [form, setForm] = useState<Partial<PeerObservation>>({
    date: todayBs(),
    teacherName: "",
    observerName: profile?.name || "",
    department: profile?.dept || "Management",
    className: "",
    subject: "",
    topic: "",
    duration: "४५ मिनेट",
    studentCount: 30,
    scores: { 1: 5, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4 },
    strengths: "",
    areasForImprovement: "",
    suggestions: "",
    overallRemarks: "",
    observerDate: todayBs(),
    teacherDate: todayBs(),
    teacherAck: "",
  });

  const loadData = () => {
    if (!profile?.name) return;
    const myLogs = getObservationsByObserver(profile.name, profile.id);
    setLogs(myLogs);
  };

  useEffect(() => {
    loadData();
    const handleChanged = () => loadData();
    window.addEventListener("shikshak-peer-obs-changed", handleChanged);
    return () => window.removeEventListener("shikshak-peer-obs-changed", handleChanged);
  }, [profile?.name, profile?.id]);

  useEffect(() => {
    // Load teachers for dropdown
    const deptId = lk.departments.find((d) => d.name === profile?.dept)?.id || "";
    void D.loadDeptTeachers(deptId, profile?.dept || "").then((tList) => {
      setDeptTeachers(tList || []);
    });
  }, [lk.departments, profile?.dept]);

  const currentScores = (form.scores || {}) as Record<number, number>;
  const currentTotal = calcTotalScore(currentScores);
  const currentGradeInfo = calcGrade(currentTotal);

  const handleScoreChange = (critId: number, val: number) => {
    const updated = { ...currentScores, [critId]: val };
    setForm({
      ...form,
      scores: updated,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacherName || !form.topic) {
      alert("कृपया सम्बन्धित शिक्षकको नाम र पाठको शीर्षक भर्नुहोस्।");
      return;
    }

    const total = calcTotalScore(currentScores);
    const gradeObj = calcGrade(total);

    const payload: PeerObservation = {
      id: form.id || `peer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      teacherName: form.teacherName || "",
      teacherId: form.teacherId || "",
      observerName: form.observerName || profile?.name || "",
      observerId: form.observerId || profile?.id || "",
      department: form.department || profile?.dept || "Management",
      className: form.className || "",
      subject: form.subject || "",
      topic: form.topic || "",
      date: form.date || todayBs(),
      duration: form.duration || "४५ मिनेट",
      studentCount: Number(form.studentCount) || 0,
      scores: currentScores,
      totalScore: total,
      percentage: Math.round((total / 50) * 100),
      grade: gradeObj.grade,
      strengths: form.strengths || "",
      areasForImprovement: form.areasForImprovement || "",
      suggestions: form.suggestions || "",
      overallRemarks: form.overallRemarks || "",
      observerDate: form.observerDate || form.date || todayBs(),
      teacherDate: form.teacherDate || form.date || todayBs(),
      teacherAck: form.teacherAck || "",
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    savePeerObservation(payload);
    setIsEditing(false);
    loadData();
    alert("सहकर्मी शिक्षण अवलोकन फाराम सफलतापूर्वक सुरक्षित गरियो!");
  };

  const handleDelete = (id: string) => {
    if (!confirm("के तपाईं यो सहकर्मी अवलोकन अभिलेख हटाउन निश्चित हुनुहुन्छ?")) return;
    deletePeerObservation(id);
    loadData();
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="font-bold text-base text-primary">
            Peer Teaching Observation · सहकर्मी शिक्षण अवलोकन फाराम
          </h3>
          <p className="text-xs text-muted-foreground">
            एक शिक्षकले अर्को शिक्षकको कक्षा अवलोकन गरी रचनात्मक पृष्ठपोषण आदानप्रदान गर्ने आधिकारिक फारम (पूर्णाङ्क ५०)
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            className="btn btn-primary !py-1.5 !px-3.5 text-xs font-bold"
            onClick={() => {
              setForm({
                id: "",
                date: todayBs(),
                teacherName: deptTeachers.filter((t) => t.name !== profile?.name)[0]?.name || "",
                observerName: profile?.name || "",
                department: profile?.dept || "Management",
                className: "",
                subject: "",
                topic: "",
                duration: "४५ मिनेट",
                studentCount: 30,
                scores: { 1: 5, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4 },
                strengths: "",
                areasForImprovement: "",
                suggestions: "",
                overallRemarks: "",
                observerDate: todayBs(),
                teacherDate: todayBs(),
                teacherAck: "",
              });
              setIsEditing(true);
              setSinglePrint(null);
            }}
          >
            + नयाँ सहकर्मी अवलोकन (New Observation)
          </button>
        )}
      </div>

      {/* 1. INTERACTIVE OBSERVATION FORM */}
      {isEditing && (
        <section className="no-print panel rounded-2xl border border-primary/40 bg-card p-5 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold text-primary tracking-wide uppercase">Myagdi Multiple Campus, Beni, Myagdi</div>
              <h3 className="font-black text-lg text-foreground">
                {form.id ? "सहकर्मी शिक्षण अवलोकन सम्पादन (Edit Form)" : "Peer Teaching Observation Form (सहकर्मी शिक्षण अवलोकन फाराम)"}
              </h3>
            </div>
            <button
              type="button"
              className="btn-soft !py-1 !px-2.5 text-xs"
              onClick={() => setIsEditing(false)}
            >
              ✕ बन्द गर्नुहोस्
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6 text-xs">
            {/* SECTION A: General Information */}
            <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
              <h4 className="font-bold text-sm text-primary border-b border-border pb-1">
                Section A: General Information (सामान्य विवरण)
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="lbl">शिक्षकको नाम (Name of Teacher Observed) *</label>
                  {deptTeachers.length > 0 ? (
                    <select
                      className="field font-bold text-foreground"
                      value={form.teacherName || ""}
                      onChange={(e) => {
                        const matched = deptTeachers.find((t) => t.name === e.target.value);
                        setForm({
                          ...form,
                          teacherName: e.target.value,
                          teacherId: matched?.user_id || "",
                        });
                      }}
                      required
                    >
                      <option value="">— शिक्षक छान्नुहोस् —</option>
                      {deptTeachers.map((t) => (
                        <option key={t.user_id} value={t.name}>
                          {t.name} ({t.dept || profile?.dept || "विभाग"})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="field font-bold text-foreground"
                      placeholder="शिक्षकको नाम"
                      value={form.teacherName || ""}
                      onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="lbl">अवलोकनकर्ताको नाम (Name of Observer) *</label>
                  <input
                    type="text"
                    className="field font-semibold"
                    value={form.observerName || profile?.name || ""}
                    onChange={(e) => setForm({ ...form, observerName: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">विभाग (Department)</label>
                  <input
                    type="text"
                    className="field"
                    value={form.department || profile?.dept || "Management"}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                </div>

                <div>
                  <label className="lbl">कक्षा / तह (Class / Level) *</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="e.g. BBS 1st Year / MBS III"
                    value={form.className || ""}
                    onChange={(e) => setForm({ ...form, className: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">विषय (Subject) *</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="e.g. Research Methodology"
                    value={form.subject || ""}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">पाठको शीर्षक (Topic) *</label>
                  <input
                    type="text"
                    className="field font-semibold text-primary"
                    placeholder="e.g. Concept and Meaning of Research"
                    value={form.topic || ""}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">अवलोकन मिति (Date - BS) *</label>
                  <input
                    type="text"
                    className="field font-bold"
                    placeholder="YYYY-MM-DD"
                    value={form.date || todayBs()}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">समय / अवधि (Time / Duration)</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="e.g. ४५ मिनेट (11:00 - 11:45 AM)"
                    value={form.duration || "४५ मिनेट"}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  />
                </div>

                <div>
                  <label className="lbl">विद्यार्थी संख्या (No. of Students)</label>
                  <input
                    type="number"
                    className="field"
                    placeholder="30"
                    value={form.studentCount || 0}
                    onChange={(e) => setForm({ ...form, studentCount: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* SECTION B: Classroom Observation Rubric */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                <div>
                  <h4 className="font-bold text-sm text-primary">
                    Section B: Classroom Observation (कक्षा अवलोकन - १० सूचकहरू)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    तलका प्रत्येक सूचकमा १ देखि ५ सम्म उपयुक्त अंक दिनुहोस्। (५ = उत्कृष्ट, ४ = धेरै राम्रो, ३ = राम्रो, २ = सन्तोषजनक, १ = सुधार आवश्यक)
                  </p>
                </div>

                {/* Live Scorecard Chip */}
                <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 border border-primary/20">
                  <div className="text-right leading-tight">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Score</div>
                    <div className="text-base font-black text-primary">
                      {currentTotal} <span className="text-xs font-normal text-muted-foreground">/ ५०</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${currentGradeInfo.color}`}>
                    {currentGradeInfo.grade} ({currentGradeInfo.labelNe})
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="rtable w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-center w-12">क्र.सं.</th>
                      <th className="p-2 text-left">Observation Criteria (अवलोकनका सूचक)</th>
                      <th className="p-2 text-center w-64">अंक छनोट (Scale 1–5)</th>
                      <th className="p-2 text-center w-20">प्राप्ताङ्क</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PEER_OBS_CRITERIA.map((c) => {
                      const val = Number(currentScores[c.id]) || 4;
                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition">
                          <td className="p-2 text-center font-bold text-muted-foreground">{c.id}</td>
                          <td className="p-2">
                            <div className="font-bold text-foreground">{c.ne}</div>
                            <div className="text-[10px] text-muted-foreground">{c.en}</div>
                          </td>
                          <td className="p-2 text-center">
                            <div className="inline-flex rounded-lg border border-border p-0.5 bg-secondary/40 gap-1">
                              {[1, 2, 3, 4, 5].map((score) => (
                                <button
                                  key={score}
                                  type="button"
                                  onClick={() => handleScoreChange(c.id, score)}
                                  className={`w-8 h-7 rounded-md font-bold text-xs transition ${
                                    val === score
                                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                                  }`}
                                  title={`${score} अंक`}
                                >
                                  {score}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-2 text-center font-black text-sm text-primary">
                            {val}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-primary/5 font-bold border-t-2 border-primary/30">
                      <td colSpan={2} className="p-2.5 text-right font-black text-sm">
                        Total Score (पूर्णाङ्क ५०):
                      </td>
                      <td colSpan={2} className="p-2.5 text-center font-black text-base text-primary">
                        {currentTotal} / ५० ({Math.round((currentTotal / 50) * 100)}% · {currentGradeInfo.grade})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION C: Feedback and Suggestions */}
            <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3.5">
              <h4 className="font-bold text-sm text-primary border-b border-border pb-1">
                Section C: Feedback and Suggestions (पृष्ठपोषण तथा सुझाव)
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="lbl font-bold">1. Strengths of the Lesson (पाठका सबल पक्षहरू) *</label>
                  <textarea
                    rows={3}
                    className="field !text-xs"
                    placeholder="शिक्षकको विषयवस्तुको ज्ञान, प्रस्तुति कला, प्रविधिको प्रयोग, विद्यार्थी आकर्षण..."
                    value={form.strengths || ""}
                    onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl font-bold">2. Areas for Improvement (सुधार गर्नुपर्ने पक्षहरू) *</label>
                  <textarea
                    rows={3}
                    className="field !text-xs"
                    placeholder="कक्षामा देखिएका कमीकमजोरी तथा थप ध्यान दिनुपर्ने क्षेत्रहरू..."
                    value={form.areasForImprovement || ""}
                    onChange={(e) => setForm({ ...form, areasForImprovement: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl font-bold">3. Suggestions for Improvement (सुधारका लागि सुझावहरू) *</label>
                  <textarea
                    rows={3}
                    className="field !text-xs"
                    placeholder="आगामी शिक्षणलाई थप प्रभावकारी बनाउन शिक्षकलाई दिइएका ठोस र व्यावहारिक सुझावहरू..."
                    value={form.suggestions || ""}
                    onChange={(e) => setForm({ ...form, suggestions: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl font-bold">4. Overall Remarks (समग्र टिप्पणी) *</label>
                  <textarea
                    rows={3}
                    className="field !text-xs"
                    placeholder="समग्र कक्षा शिक्षणको प्रभावकारिता र सहकर्मी अवलोकनको समग्र समीक्षा..."
                    value={form.overallRemarks || ""}
                    onChange={(e) => setForm({ ...form, overallRemarks: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* SECTION D: Confirmation */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h4 className="font-bold text-sm text-primary border-b border-border pb-1">
                Section D: Confirmation & Signatures (हस्ताक्षर तथा मिति)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3 bg-secondary/10 space-y-2">
                  <div className="font-bold text-xs text-foreground">अवलोकनकर्ता (Observer):</div>
                  <div>नाम: <b>{form.observerName || profile?.name}</b></div>
                  <div>मिति: <b>{fmtBs(form.observerDate || todayBs())}</b></div>
                </div>

                <div className="rounded-lg border border-border p-3 bg-secondary/10 space-y-2">
                  <div className="font-bold text-xs text-foreground">सम्बन्धित शिक्षक (Observed Teacher):</div>
                  <div>नाम: <b>{form.teacherName || "—"}</b></div>
                  <div>मिति: <b>{fmtBs(form.teacherDate || todayBs())}</b></div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                type="button"
                className="btn-soft"
                onClick={() => setIsEditing(false)}
              >
                रद्द गर्नुहोस् (Cancel)
              </button>
              <button
                type="submit"
                className="btn btn-primary !px-5 font-bold"
              >
                फाराम सुरक्षित गर्नुहोस् (Save Peer Observation)
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 2. PRINTABLE OFFICIAL FORM PREVIEW */}
      {singlePrint && (
        <section className="panel mb-4 shadow-2xl border-primary/40">
          <div className="no-print mb-3 flex items-center justify-between border-b border-border pb-2">
            <span className="font-bold text-xs text-primary">सहकर्मी शिक्षण अवलोकन फाराम मुद्रण (Official Print Preview)</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary !py-1 !px-3 text-xs font-bold"
                onClick={() => window.print()}
              >
                🖨️ प्रिन्ट गर्नुहोस् (Print)
              </button>
              <button
                type="button"
                className="btn-soft !py-1 !px-2.5 text-xs"
                onClick={() => setSinglePrint(null)}
              >
                ✕ बन्द गर्नुहोस्
              </button>
            </div>
          </div>

          <div className="p-2 sm:p-5 text-xs">
            <div className="text-center mb-3">
              <h2 className="font-black text-base text-primary uppercase">MYAGDI MULTIPLE CAMPUS</h2>
              <div className="text-xs font-semibold text-muted-foreground">Beni, Myagdi</div>
              <h3 className="font-black text-sm mt-1 border-b border-border pb-1">
                Peer Teaching Observation Form (सहकर्मी शिक्षण अवलोकन फाराम)
              </h3>
            </div>

            {/* Section A */}
            <div className="mb-4">
              <div className="font-bold text-xs text-primary mb-1">Section A: General Information (सामान्य विवरण)</div>
              <table className="rtable w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-48 font-semibold bg-muted/30">Name of Teacher (शिक्षकको नाम)</td>
                    <td className="font-bold text-primary">{singlePrint.teacherName}</td>
                    <td className="w-48 font-semibold bg-muted/30">Name of Observer (अवलोकनकर्ता)</td>
                    <td className="font-bold">{singlePrint.observerName}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-muted/30">Department (विभाग)</td>
                    <td>{singlePrint.department}</td>
                    <td className="font-semibold bg-muted/30">Class/Level (कक्षा/तह)</td>
                    <td><b>{singlePrint.className}</b></td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-muted/30">Subject (विषय)</td>
                    <td>{singlePrint.subject}</td>
                    <td className="font-semibold bg-muted/30">Topic (पाठको शीर्षक)</td>
                    <td className="font-bold">{singlePrint.topic}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-muted/30">Date (मिति)</td>
                    <td><b>{fmtBs(singlePrint.date)}</b></td>
                    <td className="font-semibold bg-muted/30">Time/Duration & Students</td>
                    <td>{singlePrint.duration} (विद्यार्थी: {singlePrint.studentCount})</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section B */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-primary">
                  Section B: Classroom Observation (कक्षा अवलोकन सूचकहरू)
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">
                  स्केल: ५=उत्कृष्ट, ४=धेरै राम्रो, ३=राम्रो, २=सन्तोषजनक, १=सुधार आवश्यक
                </span>
              </div>
              <table className="rtable w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-1.5 text-center w-10">क्र.सं.</th>
                    <th className="p-1.5 text-left">Observation Criteria (अवलोकनका सूचक)</th>
                    <th className="p-1.5 text-center w-24">अंक (१–५)</th>
                  </tr>
                </thead>
                <tbody>
                  {PEER_OBS_CRITERIA.map((c) => (
                    <tr key={c.id}>
                      <td className="p-1.5 text-center font-bold">{c.id}</td>
                      <td className="p-1.5">
                        <b>{c.ne}</b> <span className="text-muted-foreground">({c.en})</span>
                      </td>
                      <td className="p-1.5 text-center font-bold text-sm">
                        {singlePrint.scores?.[c.id] || 4}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary/5 font-black border-t-2 border-primary/40">
                    <td colSpan={2} className="p-2 text-right text-sm">
                      Total Score (पूर्णाङ्क ५०):
                    </td>
                    <td className="p-2 text-center text-sm text-primary">
                      {singlePrint.totalScore} / ५० ({singlePrint.percentage}% · Grade {singlePrint.grade})
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section C */}
            <div className="mb-5 space-y-2">
              <div className="font-bold text-xs text-primary mb-1">
                Section C: Feedback and Suggestions (पृष्ठपोषण तथा सुझाव)
              </div>
              <table className="rtable w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-56 font-semibold align-top bg-muted/20">1. Strengths of the Lesson (पाठका सबल पक्षहरू)</td>
                    <td className="whitespace-pre-line text-foreground font-medium">{singlePrint.strengths || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold align-top bg-muted/20">2. Areas for Improvement (सुधार गर्नुपर्ने पक्षहरू)</td>
                    <td className="whitespace-pre-line text-foreground font-medium">{singlePrint.areasForImprovement || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold align-top bg-muted/20">3. Suggestions for Improvement (सुधारका लागि सुझावहरू)</td>
                    <td className="whitespace-pre-line text-foreground font-bold">{singlePrint.suggestions || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold align-top bg-muted/20">4. Overall Remarks (समग्र टिप्पणी)</td>
                    <td className="whitespace-pre-line text-foreground">{singlePrint.overallRemarks || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section D */}
            <div className="pt-2">
              <div className="font-bold text-xs text-primary mb-3">Section D: Confirmation & Signatures</div>
              <Signatures
                roles={[
                  ["अवलोकनकर्ता शिक्षक (Observer Teacher)", `${singlePrint.observerName} (मिति: ${fmtBs(singlePrint.observerDate || singlePrint.date)})`],
                  ["सम्बन्धित विषय शिक्षक (Observed Teacher)", `${singlePrint.teacherName} (मिति: ${fmtBs(singlePrint.teacherDate || singlePrint.date)})`],
                ]}
              />
            </div>
          </div>
        </section>
      )}

      {/* 3. LIST OF OBSERVATIONS CONDUCTED */}
      <section className="panel">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-primary">मेरो सहकर्मी अवलोकन अभिलेख (Observations Conducted by Me)</h4>
            <p className="text-xs text-muted-foreground">
              तपाईंले अन्य सहकर्मी शिक्षकहरूको कक्षा अवलोकन गरी प्रदान गर्नुभएको आधिकारिक फारामहरूको सूची
            </p>
          </div>
          <span className="chip-on text-xs">कुल अभिलेख: {logs.length}</span>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">तपाईंले अहिलेसम्म कुनै सहकर्मी शिक्षकको कक्षा अवलोकन भर्नुभएको छैन।</p>
            <p>
              माथिको <b>+ नयाँ सहकर्मी अवलोकन</b> बटनमा क्लिक गरी फाराम भर्न सक्नुहुन्छ।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="rtable w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2.5 text-left">मिति</th>
                  <th className="p-2.5 text-left">सम्बन्धित शिक्षक</th>
                  <th className="p-2.5 text-left">कक्षा / विषय</th>
                  <th className="p-2.5 text-left">पाठ शीर्षक</th>
                  <th className="p-2.5 text-center">अंक (५०)</th>
                  <th className="p-2.5 text-center">स्तर (Grade)</th>
                  <th className="no-print p-2.5 text-right">कार्य</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40 transition">
                    <td className="p-2.5 whitespace-nowrap font-medium">{fmtBs(l.date)}</td>
                    <td className="p-2.5 font-bold text-primary whitespace-nowrap">{l.teacherName}</td>
                    <td className="p-2.5 whitespace-nowrap text-muted-foreground">
                      {l.className} · {l.subject}
                    </td>
                    <td className="p-2.5 font-semibold text-foreground max-w-44 truncate">{l.topic}</td>
                    <td className="p-2.5 text-center font-black text-sm">
                      {l.totalScore} / ५०
                    </td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${calcGrade(l.totalScore).color}`}>
                        Grade {l.grade}
                      </span>
                    </td>
                    <td className="no-print p-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-soft !py-1 !px-2 text-[11px] font-semibold"
                          onClick={() => setSinglePrint(l)}
                          title="आधिकारिक फाराम हेर्नुहोस् तथा प्रिन्ट गर्नुहोस्"
                        >
                          View / Print
                        </button>
                        <button
                          type="button"
                          className="btn-soft !py-1 !px-2 text-[11px]"
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
                          className="btn-danger !py-1 !px-1.5 text-[11px]"
                          onClick={() => handleDelete(l.id)}
                          title="हटाउनुहोस्"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
