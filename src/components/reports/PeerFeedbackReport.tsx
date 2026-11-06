import { useEffect, useState } from "react";
import { PrintHead, Signatures } from "@/components/app/ui";
import { fmtBs, todayBs } from "@/lib/bs";
import { useTeacher } from "@/lib/store";
import {
  calcGrade,
  getObservationsForTeacher,
  PEER_OBS_CRITERIA,
  savePeerObservation,
  type PeerObservation,
} from "@/lib/peer-obs";

export function PeerFeedbackReport() {
  const { profile } = useTeacher();
  const [logs, setLogs] = useState<PeerObservation[]>([]);
  const [selectedObs, setSelectedObs] = useState<PeerObservation | null>(null);
  const [ackText, setAckText] = useState("");

  const loadData = () => {
    if (!profile?.name) return;
    const received = getObservationsForTeacher(profile.name, profile.id);
    setLogs(received);
  };

  useEffect(() => {
    loadData();
    const handleChanged = () => loadData();
    window.addEventListener("shikshak-peer-obs-changed", handleChanged);
    return () => window.removeEventListener("shikshak-peer-obs-changed", handleChanged);
  }, [profile?.name, profile?.id]);

  const totalCount = logs.length;
  const avgScore = totalCount > 0 ? Math.round(logs.reduce((acc, l) => acc + l.totalScore, 0) / totalCount) : 0;
  const avgGradeObj = calcGrade(avgScore);

  const handleSaveAck = (obs: PeerObservation) => {
    if (!ackText.trim()) return;
    const updated: PeerObservation = {
      ...obs,
      teacherAck: ackText.trim(),
      teacherDate: todayBs(),
      updatedAt: new Date().toISOString(),
    };
    savePeerObservation(updated);
    setSelectedObs(updated);
    loadData();
    alert("तपाईंको प्रतिक्रिया सफलतापूर्वक सुरक्षित गरियो!");
  };

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-primary">{totalCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">प्राप्त सहकर्मी अवलोकनहरू (Observations Received)</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-primary">
            {avgScore} <span className="text-xs font-normal text-muted-foreground">/ ५०</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">औसत प्राप्ताङ्क (Average Score: {Math.round((avgScore / 50) * 100)}%)</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
          <div className="text-xl font-black text-foreground">
            <span className={`px-2.5 py-0.5 rounded-lg text-sm ${avgGradeObj.color}`}>
              Grade {avgGradeObj.grade}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">समग्र औसत स्तर ({avgGradeObj.labelNe})</div>
        </div>
      </div>

      {/* Single Observation View / Print */}
      {selectedObs && (
        <section className="panel mb-4 shadow-2xl border-primary/40">
          <div className="no-print mb-3 flex items-center justify-between border-b border-border pb-2">
            <span className="font-bold text-xs text-primary">सहकर्मी अवलोकन फाराम विवरण (Observation Details)</span>
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
                onClick={() => setSelectedObs(null)}
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
                Peer Teaching Observation Report (सहकर्मी शिक्षण अवलोकन प्रतिवेदन)
              </h3>
            </div>

            {/* Section A */}
            <div className="mb-4">
              <div className="font-bold text-xs text-primary mb-1">Section A: General Information (सामान्य विवरण)</div>
              <table className="rtable w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-48 font-semibold bg-muted/30">Name of Teacher (सम्बन्धित शिक्षक)</td>
                    <td className="font-bold text-primary">{selectedObs.teacherName}</td>
                    <td className="w-48 font-semibold bg-muted/30">Name of Observer (अवलोकनकर्ता)</td>
                    <td className="font-bold">{selectedObs.observerName}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-muted/30">Department (विभाग)</td>
                    <td>{selectedObs.department}</td>
                    <td className="font-semibold bg-muted/30">Class/Level (कक्षा/तह)</td>
                    <td><b>{selectedObs.className}</b></td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-muted/30">Subject (विषय)</td>
                    <td>{selectedObs.subject}</td>
                    <td className="font-semibold bg-muted/30">Topic (पाठको शीर्षक)</td>
                    <td className="font-bold">{selectedObs.topic}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-muted/30">Date (अवलोकन मिति)</td>
                    <td><b>{fmtBs(selectedObs.date)}</b></td>
                    <td className="font-semibold bg-muted/30">Time/Duration & Students</td>
                    <td>{selectedObs.duration} (विद्यार्थी संख्या: {selectedObs.studentCount})</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section B */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-primary">
                  Section B: Classroom Observation Scores (कक्षा अवलोकन प्राप्ताङ्क)
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
                        {selectedObs.scores?.[c.id] || 4}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary/5 font-black border-t-2 border-primary/40">
                    <td colSpan={2} className="p-2 text-right text-sm">
                      Total Score (पूर्णाङ्क ५०):
                    </td>
                    <td className="p-2 text-center text-sm text-primary">
                      {selectedObs.totalScore} / ५० ({selectedObs.percentage}% · Grade {selectedObs.grade})
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section C */}
            <div className="mb-4 space-y-2">
              <div className="font-bold text-xs text-primary mb-1">
                Section C: Feedback and Suggestions (सहकर्मीले दिएका सुझावहरू)
              </div>
              <table className="rtable w-full text-xs">
                <tbody>
                  <tr>
                    <td className="w-56 font-semibold align-top bg-muted/20">1. Strengths of the Lesson (पाठका सबल पक्षहरू)</td>
                    <td className="whitespace-pre-line text-foreground font-medium">{selectedObs.strengths || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold align-top bg-muted/20">2. Areas for Improvement (सुधार गर्नुपर्ने पक्षहरू)</td>
                    <td className="whitespace-pre-line text-foreground font-medium">{selectedObs.areasForImprovement || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold align-top bg-muted/20">3. Suggestions for Improvement (सुधारका लागि सुझावहरू)</td>
                    <td className="whitespace-pre-line text-foreground font-bold">{selectedObs.suggestions || "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold align-top bg-muted/20">4. Overall Remarks (समग्र टिप्पणी)</td>
                    <td className="whitespace-pre-line text-foreground">{selectedObs.overallRemarks || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section D */}
            <div className="pt-2">
              <div className="font-bold text-xs text-primary mb-3">Section D: Confirmation & Signatures</div>
              <Signatures
                roles={[
                  ["अवलोकनकर्ता शिक्षक (Observer Teacher)", `${selectedObs.observerName} (मिति: ${fmtBs(selectedObs.observerDate || selectedObs.date)})`],
                  ["सम्बन्धित शिक्षक (Observed Teacher)", `${selectedObs.teacherName} (मिति: ${fmtBs(selectedObs.teacherDate || selectedObs.date)})`],
                ]}
              />

              {/* Teacher Acknowledgment Note Box */}
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="font-bold text-xs text-primary mb-1.5">
                  सम्बन्धित शिक्षकको प्रतिक्रिया तथा स्वीकृति (Teacher's Acknowledgment):
                </div>
                {selectedObs.teacherAck ? (
                  <p className="text-xs italic text-foreground font-medium">{selectedObs.teacherAck}</p>
                ) : (
                  <div className="no-print flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <input
                      type="text"
                      className="field !text-xs flex-1"
                      placeholder="मैले यो पृष्ठपोषण अध्ययन गरेँ र सुधारका लागि कक्षामा लागू गर्नेछु..."
                      value={ackText}
                      onChange={(e) => setAckText(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary !py-1.5 !px-3 text-xs whitespace-nowrap font-bold"
                      onClick={() => handleSaveAck(selectedObs)}
                    >
                      प्रतिक्रिया सुरक्षित गर्नुहोस्
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* List of Received Observations */}
      <section className="panel">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-primary">प्राप्त सहकर्मी अवलोकनहरू (Peer Observations on My Teaching)</h4>
            <p className="text-xs text-muted-foreground">
              अन्य सहकर्मी शिक्षकहरूले तपाईंको कक्षा अवलोकन गरी प्रदान गर्नुभएको पृष्ठपोषण फारामहरू
            </p>
          </div>
          <span className="chip-on text-xs">कुल फाराम: {logs.length}</span>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-6 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">तपाईंको शिक्षणमा अहिलेसम्म कुनै सहकर्मी अवलोकन फाराम दाखिला भएको छैन।</p>
            <p className="text-[11px]">
              जब कुनै सहकर्मी शिक्षकले <b>Records → Peer Observation</b> बाट तपाईंको कक्षा अवलोकन फाराम भर्नुहुन्छ, त्यो यहाँ स्वतः देखिनेछ।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="rtable w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2.5 text-left">मिति</th>
                  <th className="p-2.5 text-left">अवलोकनकर्ता शिक्षक (Observer)</th>
                  <th className="p-2.5 text-left">कक्षा / विषय</th>
                  <th className="p-2.5 text-left">पाठ शीर्षक</th>
                  <th className="p-2.5 text-center">प्राप्ताङ्क (५०)</th>
                  <th className="p-2.5 text-center">स्तर (Grade)</th>
                  <th className="no-print p-2.5 text-right">कार्य</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40 transition">
                    <td className="p-2.5 whitespace-nowrap font-medium">{fmtBs(l.date)}</td>
                    <td className="p-2.5 font-bold text-primary whitespace-nowrap">{l.observerName}</td>
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
                      <button
                        type="button"
                        className="btn btn-primary !py-1 !px-2.5 text-[11px] font-semibold"
                        onClick={() => {
                          setSelectedObs(l);
                          setAckText(l.teacherAck || "");
                        }}
                      >
                        फारम हेर्नुहोस् (View Form)
                      </button>
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
