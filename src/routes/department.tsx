import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTeacher, studentsOf } from "@/lib/store";
import { todayBs, fmtBs } from "@/lib/bs";
import { pct, totalLhDone } from "@/lib/progress";

export const Route = createFileRoute("/department")({
  head: () => ({
    meta: [
      { title: "Department Management — Shikshak Diary" },
      { name: "description", content: "Faculty monitoring, classroom observation, and periodic academic reports." },
    ],
  }),
  component: DepartmentPage,
});

interface ObservationRecord {
  id: string;
  date: string;
  teacherName: string;
  classLevel: string;
  subject: string;
  topic: string;
  observerName: string;
  scores: {
    preparation: number;
    methodology: number;
    engagement: number;
    timeManagement: number;
    assessment: number;
  };
  strengths: string;
  improvements: string;
  status: "Completed" | "Follow-up Required";
}

interface PeriodicReport {
  id: string;
  submittedDate: string;
  periodType: "Monthly" | "Trimester" | "Semester" | "Annual";
  periodName: string;
  teacherName: string;
  department: string;
  totalClassesTaken: number;
  totalLhCompleted: number;
  courseCompletionPct: number;
  blendedPlansCount: number;
  sqcActivitiesCount: number;
  keyAchievements: string;
  challengesAndSupport: string;
  hodRemarks: string;
  status: "Pending Review" | "Approved" | "Revision Required";
}

interface DeptActivity {
  id: string;
  title: string;
  category: string;
  targetDate: string;
  coordinator: string;
  budgetEstimate: string;
  status: "Planned" | "Ongoing" | "Completed";
}

const STORAGE_KEY_OBS = "shikshak_dept_observations_v1";
const STORAGE_KEY_REP = "shikshak_dept_reports_v1";
const STORAGE_KEY_ACT = "shikshak_dept_activities_v1";

function DepartmentPage() {
  const { profile, data } = useTeacher();
  const today = todayBs();

  const [activeTab, setActiveTab] = useState<"overview" | "observation" | "reports" | "activities">("overview");

  // Local Persistent States
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [reports, setReports] = useState<PeriodicReport[]>([]);
  const [activities, setActivities] = useState<DeptActivity[]>([]);

  // Modals & Forms State
  const [showObsModal, setShowObsModal] = useState(false);
  const [viewingObs, setViewingObs] = useState<ObservationRecord | null>(null);
  const [showRepModal, setShowRepModal] = useState(false);
  const [reviewingRep, setReviewingRep] = useState<PeriodicReport | null>(null);
  const [showActModal, setShowActModal] = useState(false);

  // Sync with main navigation sub-menu clicks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "overview" || t === "observation" || t === "reports" || t === "activities") {
      setActiveTab(t);
    }
    const handleTabEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "overview" || detail === "observation" || detail === "reports" || detail === "activities") {
        setActiveTab(detail);
      }
    };
    window.addEventListener("shikshak-select-tab", handleTabEvent);
    return () => window.removeEventListener("shikshak-select-tab", handleTabEvent);
  }, []);

  // Load initial data from localStorage with realistic defaults
  useEffect(() => {
    try {
      const savedObs = localStorage.getItem(STORAGE_KEY_OBS);
      if (savedObs) {
        setObservations(JSON.parse(savedObs));
      } else {
        const sampleObs: ObservationRecord[] = [
          {
            id: "obs-1",
            date: "2083-07-11",
            teacherName: profile?.name || "Bishnu Acharya",
            classLevel: "MBS III",
            subject: "Research Methodology",
            topic: "Concept and Meaning of Research",
            observerName: profile?.name || "Bishnu Acharya (HoD)",
            scores: { preparation: 5, methodology: 5, engagement: 4, timeManagement: 5, assessment: 4 },
            strengths: "Well-structured 10-section blended lesson plan; strong real-world business examples and active pair discussion.",
            improvements: "Allocate 2-3 more minutes for student Q&A during the wrap-up segment.",
            status: "Completed",
          },
        ];
        setObservations(sampleObs);
        localStorage.setItem(STORAGE_KEY_OBS, JSON.stringify(sampleObs));
      }

      const savedRep = localStorage.getItem(STORAGE_KEY_REP);
      if (savedRep) {
        setReports(JSON.parse(savedRep));
      } else {
        const sampleRep: PeriodicReport[] = [
          {
            id: "rep-1",
            submittedDate: today,
            periodType: "Monthly",
            periodName: "Kartik 2083",
            teacherName: profile?.name || "Bishnu Acharya",
            department: profile?.dept || "Faculty of Management",
            totalClassesTaken: data.diary.length || 39,
            totalLhCompleted: data.diary.reduce((s, d) => s + (Number(d.lh) || 0), 0) || 44,
            courseCompletionPct: 27,
            blendedPlansCount: (data.plans || []).length || 4,
            sqcActivitiesCount: 2,
            keyAchievements: "Completed Unit 1 & 2 with blended learning models; conducted student pair workshops on research problem formulation.",
            challengesAndSupport: "Need multimedia projector maintenance in Room 204 for smoother slide presentations.",
            hodRemarks: "Well documented progress. Projector maintenance request forwarded to administration.",
            status: "Approved",
          },
        ];
        setReports(sampleRep);
        localStorage.setItem(STORAGE_KEY_REP, JSON.stringify(sampleRep));
      }

      const savedAct = localStorage.getItem(STORAGE_KEY_ACT);
      if (savedAct) {
        setActivities(JSON.parse(savedAct));
      } else {
        const sampleAct: DeptActivity[] = [
          {
            id: "act-1",
            title: "MBS Research Proposal Defense & Methodology Workshop",
            category: "Academic Seminar",
            targetDate: "2083-08-15",
            coordinator: profile?.name || "Bishnu Acharya",
            budgetEstimate: "NPR 15,000",
            status: "Planned",
          },
        ];
        setActivities(sampleAct);
        localStorage.setItem(STORAGE_KEY_ACT, JSON.stringify(sampleAct));
      }
    } catch {
      /* ignore storage errors */
    }
  }, [profile?.name, profile?.dept]);

  const saveObservations = (list: ObservationRecord[]) => {
    setObservations(list);
    localStorage.setItem(STORAGE_KEY_OBS, JSON.stringify(list));
  };

  const saveReports = (list: PeriodicReport[]) => {
    setReports(list);
    localStorage.setItem(STORAGE_KEY_REP, JSON.stringify(list));
  };

  const saveActivities = (list: DeptActivity[]) => {
    setActivities(list);
    localStorage.setItem(STORAGE_KEY_ACT, JSON.stringify(list));
  };

  // Metrics Calculation
  const openClasses = data.classes.filter((c) => !c.closed);
  const totalPlannedLh = openClasses.reduce((s, c) => s + (Number(c.totalLh) || 0), 0);
  const totalDoneLh = openClasses.reduce((s, c) => s + totalLhDone(data.diary, c.id), 0);
  const overallProgress = pct(totalDoneLh, totalPlannedLh);
  const pendingReportsCount = reports.filter((r) => r.status === "Pending Review").length;

  // New Observation Form State
  const [obsForm, setObsForm] = useState<Omit<ObservationRecord, "id">>({
    date: today,
    teacherName: profile?.name || "",
    classLevel: openClasses[0]?.name || "MBS III",
    subject: openClasses[0]?.subject || "Research Methodology",
    topic: "",
    observerName: `${profile?.name || "HoD"} (Head of Department)`,
    scores: { preparation: 4, methodology: 4, engagement: 4, timeManagement: 4, assessment: 4 },
    strengths: "",
    improvements: "",
    status: "Completed",
  });

  // New Periodic Report Form State
  const [repForm, setRepForm] = useState<Omit<PeriodicReport, "id">>({
    submittedDate: today,
    periodType: "Monthly",
    periodName: "Kartik 2083",
    teacherName: profile?.name || "",
    department: profile?.dept || "Management",
    totalClassesTaken: data.diary.length,
    totalLhCompleted: totalDoneLh,
    courseCompletionPct: overallProgress,
    blendedPlansCount: (data.plans || []).length,
    sqcActivitiesCount: 1,
    keyAchievements: "",
    challengesAndSupport: "",
    hodRemarks: "",
    status: "Pending Review",
  });

  // New Activity Form State
  const [actForm, setActForm] = useState<Omit<DeptActivity, "id">>({
    title: "",
    category: "Academic Workshop",
    targetDate: today,
    coordinator: profile?.name || "",
    budgetEstimate: "NPR 10,000",
    status: "Planned",
  });

  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    const newRec: ObservationRecord = { ...obsForm, id: "obs-" + Date.now() };
    saveObservations([newRec, ...observations]);
    setShowObsModal(false);
  };

  const handleAddReport = (e: React.FormEvent) => {
    e.preventDefault();
    const newRep: PeriodicReport = { ...repForm, id: "rep-" + Date.now() };
    saveReports([newRep, ...reports]);
    setShowRepModal(false);
  };

  const handleUpdateReportReview = () => {
    if (!reviewingRep) return;
    saveReports(reports.map((r) => (r.id === reviewingRep.id ? reviewingRep : r)));
    setReviewingRep(null);
  };

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const newAct: DeptActivity = { ...actForm, id: "act-" + Date.now() };
    saveActivities([newAct, ...activities]);
    setShowActModal(false);
  };

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Page Header */}
      <section className="panel mb-5 bg-gradient-to-br from-secondary to-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-primary">
              🏛️ {profile?.dept || "Department of Management"}
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
              Department Management & Supervision
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              विभागीय प्रमुखद्वारा शिक्षक अनुगमन, कक्षा अवलोकन र मासिक तथा आवधिक प्रतिवेदन मूल्याङ्कन प्रणाली
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowObsModal(true)}
              className="btn px-3.5 py-2 text-xs font-bold sm:text-sm"
            >
              + New Class Observation
            </button>
            <button
              type="button"
              onClick={() => setShowRepModal(true)}
              className="btn-soft px-3.5 py-2 text-xs font-bold sm:text-sm"
            >
              + Submit Periodic Report
            </button>
          </div>
        </div>
      </section>

      {/* 4 Summary KPI Cards (English Titles + Nepali Sub-captions) */}
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="kpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Monitored Classes
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-primary sm:text-3xl">{openClasses.length}</span>
            <span className="chip">{overallProgress}% Course Done</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">सक्रिय कक्षा र पाठ्यक्रम प्रगति</div>
        </div>

        <div className="kpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Class Observations
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-foreground sm:text-3xl">{observations.length}</span>
            <span className="chip-on">Supervision Logs</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">सम्पन्न कक्षा अवलोकन र फिडब्याक</div>
        </div>

        <div className="kpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Periodic Reports
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-primary sm:text-3xl">{reports.length}</span>
            <span className="chip">{pendingReportsCount} Pending Review</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">मासिक तथा आवधिक प्रतिवेदनहरू</div>
        </div>

        <div className="kpi-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dept. Activities
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-foreground sm:text-3xl">{activities.length}</span>
            <span className="chip">Annual Plan</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">विभागीय कार्ययोजना र सेमिनार</div>
        </div>
      </section>

      {/* Main Navigation Tabs inside Department */}
      <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5">
        {[
          { id: "overview", label: "1. Faculty Progress Matrix", sub: "शिक्षक कार्यसम्पादन र कोर्स प्रगति" },
          { id: "observation", label: "2. Classroom Observation", sub: "कक्षा अवलोकन र सुपरिवेक्षण" },
          { id: "reports", label: "3. Monthly & Periodic Reports", sub: "मासिक/आवधिक प्रतिवेदन समीक्षा" },
          { id: "activities", label: "4. Departmental Annual Plan", sub: "विभागीय वार्षिक गतिविधि" },
        ].map((t) => {
          const isOn = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 min-w-[200px] rounded-lg px-3.5 py-2 text-left transition ${
                isOn
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card/60 text-foreground hover:bg-card"
              }`}
            >
              <div className="text-xs font-bold sm:text-sm">{t.label}</div>
              <div className={`text-[11px] ${isOn ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                {t.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FACULTY PROGRESS MATRIX */}
      {activeTab === "overview" && (
        <section className="panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Course Completion & Teaching Log Matrix
              </h2>
              <p className="text-xs text-muted-foreground">
                प्रत्येक विषयको निर्धारित लेक्चर आवर (LH), सम्पन्न कक्षा र पाठ योजनाको वास्तविक अवस्था
              </p>
            </div>
            <button type="button" onClick={() => window.print()} className="btn-soft text-xs">
              🖨️ Print Matrix
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <th className="p-3 font-bold">Class / Level</th>
                  <th className="p-3 font-bold">Subject & Code</th>
                  <th className="p-3 font-bold">Faculty Member</th>
                  <th className="p-3 font-bold text-center">Students</th>
                  <th className="p-3 font-bold text-center">LH Completed</th>
                  <th className="p-3 font-bold">Course Progress</th>
                  <th className="p-3 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {openClasses.map((c) => {
                  const done = totalLhDone(data.diary, c.id);
                  const p = pct(done, c.totalLh);
                  const stuCount = studentsOf(c).length;
                  return (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="p-3 font-bold text-foreground">{c.name}</td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground">{c.subject}</div>
                        <div className="text-xs text-muted-foreground">{c.code || "TU Curriculum"}</div>
                      </td>
                      <td className="p-3 font-medium">{profile?.name || "Faculty"}</td>
                      <td className="p-3 text-center font-semibold">{stuCount}</td>
                      <td className="p-3 text-center">
                        <b>{done}</b> / {c.totalLh} LH
                      </td>
                      <td className="p-3 w-48">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(p, done > 0 ? 5 : 0)}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-xs font-bold text-primary">{p}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                          On Track
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!openClasses.length && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No active classes registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: CLASSROOM OBSERVATION & SUPERVISION */}
      {activeTab === "observation" && (
        <section className="space-y-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Classroom Observation & Pedagogical Supervision Records
              </h2>
              <p className="text-xs text-muted-foreground">
                विभागीय प्रमुखद्वारा कक्षाकोठाको प्रत्यक्ष अवलोकन, शिक्षण विधिको मूल्याङ्कन र पृष्ठपोषण अभिलेख
              </p>
            </div>
            <button type="button" onClick={() => setShowObsModal(true)} className="btn text-xs sm:text-sm">
              + Record Class Observation
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {observations.map((obs) => {
              const totalScore =
                obs.scores.preparation +
                obs.scores.methodology +
                obs.scores.engagement +
                obs.scores.timeManagement +
                obs.scores.assessment;
              return (
                <div key={obs.id} className="panel flex flex-col justify-between border-l-4 border-l-primary">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          {obs.classLevel} · {obs.subject}
                        </span>
                        <h3 className="mt-1.5 text-base font-bold text-foreground">{obs.topic}</h3>
                      </div>
                      <span className="chip-on shrink-0 font-bold">Score: {totalScore} / 25</span>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      <b>Faculty:</b> {obs.teacherName} · <b>Date:</b> {fmtBs(obs.date)}
                    </div>

                    <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-2.5 text-xs">
                      <div>
                        <b className="text-foreground">Key Strengths (सबल पक्ष):</b>{" "}
                        <span className="text-muted-foreground">{obs.strengths}</span>
                      </div>
                      <div>
                        <b className="text-foreground">Suggested Improvements (सुधारका सुझाव):</b>{" "}
                        <span className="text-muted-foreground">{obs.improvements}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <span className="font-medium text-muted-foreground">Observer: {obs.observerName}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingObs(obs)}
                        className="btn-soft !px-2.5 !py-1 text-xs"
                      >
                        View / Print Sheet
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          confirm("Delete this observation record?") &&
                          saveObservations(observations.filter((o) => o.id !== obs.id))
                        }
                        className="rounded border border-destructive/30 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: MONTHLY & PERIODIC REPORTS */}
      {activeTab === "reports" && (
        <section className="space-y-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Monthly & Periodic Academic Reports (Submission & HoD Sign-Off)
              </h2>
              <p className="text-xs text-muted-foreground">
                शिक्षकहरूको मासिक, त्रैमासिक वा सेमेस्टर प्रगति प्रतिवेदन सङ्कलन र विभागीय स्वीकृति
              </p>
            </div>
            <button type="button" onClick={() => setShowRepModal(true)} className="btn text-xs sm:text-sm">
              + Generate / Submit Report
            </button>
          </div>

          <div className="space-y-3">
            {reports.map((rep) => (
              <div key={rep.id} className="panel">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                        {rep.periodType} Report
                      </span>
                      <span className="text-sm font-bold text-foreground">{rep.periodName}</span>
                      <span className="text-xs text-muted-foreground">· Submitted: {fmtBs(rep.submittedDate)}</span>
                    </div>
                    <div className="mt-1 text-base font-bold text-foreground">
                      {rep.teacherName} <span className="text-xs font-normal text-muted-foreground">({rep.department})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        rep.status === "Approved"
                          ? "bg-primary/15 text-primary"
                          : rep.status === "Revision Required"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {rep.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReviewingRep(rep)}
                      className="btn-soft !px-3 !py-1.5 text-xs font-bold"
                    >
                      HoD Review / Print
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-xs">
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-muted-foreground">Classes Taken</div>
                    <div className="mt-0.5 text-base font-extrabold text-foreground">{rep.totalClassesTaken} Sessions</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-muted-foreground">Lecture Hours (LH)</div>
                    <div className="mt-0.5 text-base font-extrabold text-primary">{rep.totalLhCompleted} LH</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-muted-foreground">Syllabus Covered</div>
                    <div className="mt-0.5 text-base font-extrabold text-foreground">{rep.courseCompletionPct}%</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                    <div className="text-muted-foreground">Blended Plans / SQC</div>
                    <div className="mt-0.5 text-base font-extrabold text-foreground">
                      {rep.blendedPlansCount} Plans · {rep.sqcActivitiesCount} SQC
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <b>Key Academic Achievements (मुख्य उपलब्धिहरू):</b>
                    <p className="mt-1 text-muted-foreground">{rep.keyAchievements}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2.5">
                    <b>HoD Remarks & Feedback (विभागीय प्रमुखको टिप्पणी):</b>
                    <p className="mt-1 text-muted-foreground">
                      {rep.hodRemarks || "Pending review by Head of Department."}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 4: DEPARTMENTAL ANNUAL ACTIVITIES */}
      {activeTab === "activities" && (
        <section className="panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Departmental Annual Action Plan & Academic Events
              </h2>
              <p className="text-xs text-muted-foreground">
                विभागद्वारा आयोजना गरिने अनुसन्धान कार्यशाला, सेमिनार र शैक्षिक कार्यक्रमहरूको तालिका
              </p>
            </div>
            <button type="button" onClick={() => setShowActModal(true)} className="btn text-xs">
              + Add Departmental Activity
            </button>
          </div>

          <div className="space-y-2.5">
            {activities.map((act) => (
              <div
                key={act.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-border p-3.5 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="chip-on text-xs font-bold">{act.category}</span>
                    <span className="text-xs text-muted-foreground">📅 Target: {fmtBs(act.targetDate)}</span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground sm:text-base">{act.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Coordinator: <b>{act.coordinator}</b> · Estimated Budget: <b>{act.budgetEstimate}</b>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={act.status}
                    onChange={(e) =>
                      saveActivities(
                        activities.map((a) => (a.id === act.id ? { ...a, status: e.target.value as any } : a))
                      )
                    }
                    className="field !h-8 !w-auto !py-0 text-xs font-bold"
                  >
                    <option value="Planned">Planned</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => saveActivities(activities.filter((a) => a.id !== act.id))}
                    className="rounded border border-destructive/30 px-2.5 py-1 text-xs font-semibold text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL 1: NEW CLASSROOM OBSERVATION */}
      {showObsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAddObservation}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-foreground">New Classroom Observation Form</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              कक्षा अवलोकन मूल्याङ्कन फारम (प्रत्येक सूचकमा १ देखि ५ सम्म अङ्क दिनुहोस्)
            </p>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-bold">Faculty Name (शिक्षकको नाम)</label>
                <input
                  type="text"
                  required
                  className="field w-full"
                  value={obsForm.teacherName}
                  onChange={(e) => setObsForm({ ...obsForm, teacherName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Observation Date (अवलोकन मिति BS)</label>
                <input
                  type="text"
                  required
                  className="field w-full"
                  value={obsForm.date}
                  onChange={(e) => setObsForm({ ...obsForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Class / Semester (कक्षा/तह)</label>
                <input
                  type="text"
                  required
                  className="field w-full"
                  value={obsForm.classLevel}
                  onChange={(e) => setObsForm({ ...obsForm, classLevel: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Subject (विषय)</label>
                <input
                  type="text"
                  required
                  className="field w-full"
                  value={obsForm.subject}
                  onChange={(e) => setObsForm({ ...obsForm, subject: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block font-bold">Lesson Topic Taught (पढाइएको पाठको शीर्षक)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Research Design and Sampling Techniques"
                  className="field w-full"
                  value={obsForm.topic}
                  onChange={(e) => setObsForm({ ...obsForm, topic: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
              <div className="mb-2 font-bold text-primary">
                Pedagogical Evaluation Indicators (Rating 1 to 5)
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {[
                  { key: "preparation", label: "1. Lesson Plan & Preparation (पाठ योजना तयारी)" },
                  { key: "methodology", label: "2. Teaching Methodology & Clarity (शिक्षण विधि)" },
                  { key: "engagement", label: "3. Student Participation (विद्यार्थी सहभागिता)" },
                  { key: "timeManagement", label: "4. Time Management (समय व्यवस्थापन)" },
                  { key: "assessment", label: "5. In-Class Assessment & Wrap-up (मूल्याङ्कन)" },
                ].map((ind) => (
                  <div key={ind.key} className="flex items-center justify-between gap-2">
                    <span>{ind.label}</span>
                    <select
                      className="field !h-8 !w-20 !py-0 font-bold"
                      value={(obsForm.scores as any)[ind.key]}
                      onChange={(e) =>
                        setObsForm({
                          ...obsForm,
                          scores: { ...obsForm.scores, [ind.key]: Number(e.target.value) },
                        })
                      }
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} / 5
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold">Key Strengths Observed (सबल पक्षहरू)</label>
                <textarea
                  rows={2}
                  required
                  className="field w-full"
                  value={obsForm.strengths}
                  onChange={(e) => setObsForm({ ...obsForm, strengths: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Constructive Suggestions for Improvement (सुधारका सुझावहरू)</label>
                <textarea
                  rows={2}
                  required
                  className="field w-full"
                  value={obsForm.improvements}
                  onChange={(e) => setObsForm({ ...obsForm, improvements: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowObsModal(false)} className="btn-soft text-xs">
                Cancel
              </button>
              <button type="submit" className="btn text-xs">
                Save Observation Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: PRINTABLE OBSERVATION SHEET */}
      {viewingObs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
            <div className="no-print mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">Classroom Observation Report Sheet</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => window.print()} className="btn text-xs">
                  🖨️ Print / Save PDF
                </button>
                <button type="button" onClick={() => setViewingObs(null)} className="btn-soft text-xs">
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs print:text-black">
              <div className="text-center">
                <div className="text-base font-bold uppercase">{profile?.campus || "MYAGDI MULTIPLE CAMPUS"}</div>
                <div className="text-muted-foreground">{profile?.address || "Beni, Myagdi"}</div>
                <div className="mt-1 font-display text-lg font-bold">
                  Departmental Classroom Observation & Supervision Sheet
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                <div><b>Faculty Member:</b> {viewingObs.teacherName}</div>
                <div><b>Date:</b> {fmtBs(viewingObs.date)}</div>
                <div><b>Class / Level:</b> {viewingObs.classLevel}</div>
                <div><b>Subject:</b> {viewingObs.subject}</div>
                <div className="col-span-2"><b>Lesson Topic:</b> {viewingObs.topic}</div>
              </div>

              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border p-2 text-left">Evaluation Indicator</th>
                    <th className="border border-border p-2 text-center w-28">Score (Max 5)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border p-2">1. Lesson Planning & Instructional Readiness</td>
                    <td className="border border-border p-2 text-center font-bold">{viewingObs.scores.preparation} / 5</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-2">2. Teaching Methodology & Conceptual Clarity</td>
                    <td className="border border-border p-2 text-center font-bold">{viewingObs.scores.methodology} / 5</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-2">3. Student Engagement & Interactive Learning</td>
                    <td className="border border-border p-2 text-center font-bold">{viewingObs.scores.engagement} / 5</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-2">4. Time Allocation & Pacing</td>
                    <td className="border border-border p-2 text-center font-bold">{viewingObs.scores.timeManagement} / 5</td>
                  </tr>
                  <tr>
                    <td className="border border-border p-2">5. Formative Assessment & Lesson Wrap-up</td>
                    <td className="border border-border p-2 text-center font-bold">{viewingObs.scores.assessment} / 5</td>
                  </tr>
                </tbody>
              </table>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <div><b>Key Strengths Observed:</b> {viewingObs.strengths}</div>
                <div><b>Recommendations for Improvement:</b> {viewingObs.improvements}</div>
              </div>

              <div className="mt-8 flex justify-between border-t border-border pt-6">
                <div>
                  <div className="font-bold">{viewingObs.teacherName}</div>
                  <div className="text-muted-foreground">Faculty Signature</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{viewingObs.observerName}</div>
                  <div className="text-muted-foreground">Head of Department</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SUBMIT MONTHLY / PERIODIC REPORT */}
      {showRepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAddReport}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold">Submit Monthly / Periodic Academic Report</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              मासिक वा आवधिक शैक्षिक प्रगति प्रतिवेदन तयार गरी विभागमा पेस गर्नुहोस्
            </p>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-bold">Report Type (प्रतिवेदनको प्रकार)</label>
                <select
                  className="field w-full"
                  value={repForm.periodType}
                  onChange={(e) => setRepForm({ ...repForm, periodType: e.target.value as any })}
                >
                  <option value="Monthly">Monthly Report (मासिक)</option>
                  <option value="Trimester">Trimester Report (त्रैमासिक)</option>
                  <option value="Semester">Semester Report (सेमेस्टर)</option>
                  <option value="Annual">Annual Report (वार्षिक)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-bold">Period Name (महिना वा अवधि)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Kartik 2083 / First Semester"
                  className="field w-full"
                  value={repForm.periodName}
                  onChange={(e) => setRepForm({ ...repForm, periodName: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Total Classes Taken (सञ्चालित कक्षा संख्या)</label>
                <input
                  type="number"
                  required
                  className="field w-full"
                  value={repForm.totalClassesTaken}
                  onChange={(e) => setRepForm({ ...repForm, totalClassesTaken: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Total Lecture Hours (पूरा भएको LH)</label>
                <input
                  type="number"
                  required
                  className="field w-full"
                  value={repForm.totalLhCompleted}
                  onChange={(e) => setRepForm({ ...repForm, totalLhCompleted: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold">Key Academic Achievements & Blended Learning Summary (मुख्य उपलब्धिहरू)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Summarize units completed, blended plans executed, internal assessments, and student research guidance..."
                  className="field w-full"
                  value={repForm.keyAchievements}
                  onChange={(e) => setRepForm({ ...repForm, keyAchievements: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Challenges & Departmental Support Needed (समस्या र आवश्यक सहयोग)</label>
                <textarea
                  rows={2}
                  className="field w-full"
                  value={repForm.challengesAndSupport}
                  onChange={(e) => setRepForm({ ...repForm, challengesAndSupport: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowRepModal(false)} className="btn-soft text-xs">
                Cancel
              </button>
              <button type="submit" className="btn text-xs">
                Submit Report to Department
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: HOD REVIEW & SIGN-OFF MODAL */}
      {reviewingRep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
            <div className="no-print mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold">HoD Review & Periodic Report Sign-Off</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => window.print()} className="btn-soft text-xs">
                  🖨️ Print Report
                </button>
                <button type="button" onClick={() => setReviewingRep(null)} className="btn-soft text-xs">
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-border p-3">
                <div className="font-bold text-sm">{reviewingRep.periodType} Report — {reviewingRep.periodName}</div>
                <div className="mt-1 text-muted-foreground">
                  Faculty: <b>{reviewingRep.teacherName}</b> · Classes: <b>{reviewingRep.totalClassesTaken}</b> · LH: <b>{reviewingRep.totalLhCompleted}</b> ({reviewingRep.courseCompletionPct}%)
                </div>
                <div className="mt-2"><b>Achievements:</b> {reviewingRep.keyAchievements}</div>
                {reviewingRep.challengesAndSupport && (
                  <div className="mt-1"><b>Challenges:</b> {reviewingRep.challengesAndSupport}</div>
                )}
              </div>

              <div>
                <label className="mb-1 block font-bold">Approval Status (स्वीकृति अवस्था)</label>
                <select
                  className="field w-full font-bold"
                  value={reviewingRep.status}
                  onChange={(e) => setReviewingRep({ ...reviewingRep, status: e.target.value as any })}
                >
                  <option value="Pending Review">Pending Review</option>
                  <option value="Approved">Approved (स्वीकृत)</option>
                  <option value="Revision Required">Revision Required (परिमार्जन आवश्यक)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold">Head of Department Remarks (विभागीय प्रमुखको टिप्पणी)</label>
                <textarea
                  rows={3}
                  className="field w-full"
                  placeholder="Enter official review remarks and feedback..."
                  value={reviewingRep.hodRemarks}
                  onChange={(e) => setReviewingRep({ ...reviewingRep, hodRemarks: e.target.value })}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 no-print">
                <button type="button" onClick={handleUpdateReportReview} className="btn text-xs">
                  Save HoD Sign-Off
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD DEPARTMENTAL ACTIVITY */}
      {showActModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAddActivity}
            className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl text-xs space-y-3"
          >
            <h2 className="text-base font-bold">Add Departmental Activity / Event</h2>
            <div>
              <label className="mb-1 block font-bold">Activity Title (कार्यक्रमको नाम)</label>
              <input
                type="text"
                required
                className="field w-full"
                value={actForm.title}
                onChange={(e) => setActForm({ ...actForm, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold">Category</label>
                <input
                  type="text"
                  required
                  className="field w-full"
                  value={actForm.category}
                  onChange={(e) => setActForm({ ...actForm, category: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Target Date (BS)</label>
                <input
                  type="text"
                  required
                  className="field w-full"
                  value={actForm.targetDate}
                  onChange={(e) => setActForm({ ...actForm, targetDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold">Coordinator</label>
                <input
                  type="text"
                  required
                  className="field w-full"
                  value={actForm.coordinator}
                  onChange={(e) => setActForm({ ...actForm, coordinator: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Estimated Budget</label>
                <input
                  type="text"
                  className="field w-full"
                  value={actForm.budgetEstimate}
                  onChange={(e) => setActForm({ ...actForm, budgetEstimate: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowActModal(false)} className="btn-soft text-xs">
                Cancel
              </button>
              <button type="submit" className="btn text-xs">
                Save Activity
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
