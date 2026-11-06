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
  duration: string; // e.g. ४५ मिनेट, ५० मिनेट
  
  // 1. शिक्षण विधि (एक भन्दा बढी टिक लगाउन सकिने)
  methods: string[];
  otherMethod?: string;
  
  // 2. शिक्षण सामग्री तथा प्रविधि (एक भन्दा बढी टिक लगाउन सकिने)
  materials: string[];
  otherMaterial?: string;
  
  // 3. समयको पालना तथा कक्षा व्यवस्थापन
  punctuality: string; // समयमै प्रवेश र समापन / केही ढिलो / ढिलो
  timePacing: string;  // सन्तुलित / सामान्य / असन्तुलित
  discipline: string;  // उत्कृष्ट / राम्रो / सुधार आवश्यक
  boardWork: string;   // सफा र बुँदागत / सामान्य / अव्यवस्थित
  
  // 4. विद्यार्थी सहभागिता तथा अन्तरक्रिया
  engagementLevel: string; // उच्च (८०%+), मध्यम (५०-८०%), न्यून (<५०%)
  questioningOpportunity: string; // प्रशस्त अवसर / सामान्य / एकपक्षीय
  inclusiveness: string; // समान र समावेशी / सुधार आवश्यक
  
  // 5. सिकाइ परीक्षण तथा विद्यार्थी मूल्याङ्कन
  assessmentMethods: string[]; // मौखिक प्रश्नोत्तर, क्विज, बोर्ड अभ्यास, आदि
  comprehensionLevel: string;  // अधिकांशले बुझेका / मध्यम / पुनः शिक्षण आवश्यक
  immediateFeedback: string;   // दिइएको / आंशिक / नदिइएको
  homeworkAssigned: string;    // दिइयो / पूर्वतयारी निर्देशन / छैन
  homeworkDetail?: string;
  
  // 6. गुणात्मक समीक्षा तथा पृष्ठपोषण
  strengths: string;   // सबल पक्षहरू
  suggestions: string; // सुधार गर्नुपर्ने क्षेत्र तथा ठोस सुझावहरू
  
  // 7. समग्र स्तर तथा हस्ताक्षर
  overallGrade: "A" | "B" | "C" | "D"; // A=उत्कृष्ट, B=राम्रो, C=सन्तोषजनक, D=सुधार आवश्यक
  observerName: string;
  observerRole: string;
  teacherFeedback?: string; // शिक्षकको प्रतिक्रिया
};

export type MonthlyReviewNote = {
  teacherId: string;
  month: string;
  remarks: string;
  status: "reviewed" | "pending" | "action_needed";
  updatedAt: string;
};

export type DeptMeeting = {
  id: string;
  deptId: string;
  year: string;
  meetingNo: string;
  date: string;
  title: string;
  chairperson: string;
  presentMembers: string[];
  agendas: string;
  decisions: string;
  actionPlan: string;
};

// Checkbox Options
export const TEACHING_METHODS_OPTIONS = [
  "व्याख्यान विधि (Lecture Method)",
  "प्रश्नोत्तर तथा अन्तरक्रिया (Question & Answer)",
  "समूह छलफल तथा अन्तरक्रिया (Group Discussion)",
  "प्रविधि / मल्टिमिडिया / प्रोजेक्टर (ICT / Multimedia / PPT)",
  "प्रयोगात्मक / समस्या समाधान (Problem Solving / Practical)",
  "केस स्टडी तथा प्रस्तुतीकरण (Case Study / Presentation)",
  "जोडी कार्य / सहपाठी सिकाइ (Pair Work / Peer Learning)",
  "प्रदर्शन तथा नमुना अभ्यास (Demonstration / Modeling)",
];

export const TEACHING_MATERIALS_OPTIONS = [
  "सेतोपाटी तथा मार्कर (Whiteboard & Marker)",
  "डिजिटल स्लाइड तथा प्रोजेक्टर (PPT / Projector)",
  "पाठ्यपुस्तक तथा सन्दर्भ ग्रन्थ (Textbook & Reference)",
  "कार्यपत्र तथा ह्यान्डआउट (Worksheets / Handouts)",
  "श्रव्यदृश्य / अनलाइन भिडियो (Audio/Video / Online media)",
  "चार्ट, तालिका वा वास्तविक वस्तु (Charts / Tables / Real Objects)",
];

export const FORMATIVE_ASSESSMENT_OPTIONS = [
  "मौखिक प्रश्नोत्तर (Oral Questioning)",
  "बोर्डमा विद्यार्थीबाट अभ्यास (Board Practice by Students)",
  "कार्यपत्र / छोटो क्विज (Worksheet / Spot Quiz)",
  "जोडी / समूह प्रस्तुतीकरण मूल्याङ्कन (Group Presentation Assessment)",
  "अवलोकन तथा कक्षाकार्य जाँच (Classwork Inspection)",
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
  const [subTab, setSubTab] = useState<"observations" | "reviews" | "meetings">("observations");
  
  // Data State
  const [logs, setLogs] = useState<ObservationLog[]>([]);
  const [teachers, setTeachers] = useState<D.DeptTeacher[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, MonthlyReviewNote>>({});
  const [meetings, setMeetings] = useState<DeptMeeting[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("7"); // Kartik
  
  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [singlePrint, setSinglePrint] = useState<ObservationLog | null>(null);
  const [singlePrintMeeting, setSinglePrintMeeting] = useState<DeptMeeting | null>(null);

  // Form State for Observation
  const [form, setForm] = useState<Partial<ObservationLog>>({
    date: todayBs(),
    teacherName: "",
    className: "",
    subject: "",
    topic: "",
    duration: "४५ मिनेट",
    methods: [TEACHING_METHODS_OPTIONS[0], TEACHING_METHODS_OPTIONS[1]],
    materials: [TEACHING_MATERIALS_OPTIONS[0]],
    punctuality: "समयमै कक्षा प्रवेश तथा समयमै समापन (Punctual entry & exit)",
    timePacing: "सन्तुलित समय विभाजन (Well-balanced pacing)",
    discipline: "अनुशासित, शान्त र सिकाइमैत्री (Disciplined & conducive)",
    boardWork: "सफा, स्पष्ट र बुँदागत (Clear & well-organized)",
    engagementLevel: "उच्च (८०%+ विद्यार्थी सक्रिय र जिज्ञासु)",
    questioningOpportunity: "विद्यार्थीलाई प्रशस्त अवसर र प्रोत्साहन दिइएको",
    inclusiveness: "सबै विद्यार्थीलाई समान र समावेशी अवसर",
    assessmentMethods: [FORMATIVE_ASSESSMENT_OPTIONS[0]],
    comprehensionLevel: "अधिकांश विद्यार्थीले पाठको उद्देश्य स्पष्ट बुझेको",
    immediateFeedback: "तत्काल मौखिक पृष्ठपोषण दिइएको",
    homeworkAssigned: "सान्दर्भिक गृहकार्य / अभ्यास कार्य दिइयो",
    strengths: "",
    suggestions: "",
    overallGrade: "A",
    observerName: profile?.name || "",
    observerRole: admin ? "Campus Chief / Administration" : "Head of Department",
    teacherFeedback: "",
  });

  // Form State for Meeting
  const [meetingForm, setMeetingForm] = useState<Partial<DeptMeeting>>({
    meetingNo: "१",
    date: todayBs(),
    title: "",
    chairperson: profile?.name || "",
    presentMembers: [],
    agendas: "",
    decisions: "",
    actionPlan: "",
  });

  const storageKey = useMemo(() => `shikshak-dept-supervision-v2-${dept}-${year}`, [dept, year]);
  const reviewStorageKey = useMemo(() => `shikshak-dept-monthly-reviews-${dept}-${year}`, [dept, year]);
  const meetingsStorageKey = useMemo(() => `shikshak-dept-meetings-${dept}-${year}`, [dept, year]);

  // Load department teachers & local data
  useEffect(() => {
    if (!dept) return;
    void D.loadDeptTeachers(dept, deptName).then((list) => {
      setTeachers(list || []);
    });

    // 1. Observations
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLogs(parsed);
      } else {
        // Fallback check legacy key
        const legacyRaw = localStorage.getItem(`shikshak-dept-supervision-${dept}-${year}`);
        if (legacyRaw) {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy)) {
            const upgraded = parsedLegacy.map((item) => ({
              ...item,
              methods: Array.isArray(item.methods) ? item.methods : item.method ? [item.method] : [TEACHING_METHODS_OPTIONS[0]],
              materials: Array.isArray(item.materials) ? item.materials : [TEACHING_MATERIALS_OPTIONS[0]],
              punctuality: item.punctuality || "समयमै कक्षा प्रवेश तथा समयमै समापन (Punctual entry & exit)",
              timePacing: item.timePacing || "सन्तुलित समय विभाजन (Well-balanced pacing)",
              discipline: item.discipline || "अनुशासित, शान्त र सिकाइमैत्री (Disciplined & conducive)",
              boardWork: item.boardWork || "सफा, स्पष्ट र बुँदागत (Clear & well-organized)",
              engagementLevel: item.engagementLevel || item.participation || "उच्च (८०%+ विद्यार्थी सक्रिय र जिज्ञासु)",
              questioningOpportunity: item.questioningOpportunity || "विद्यार्थीलाई प्रशस्त अवसर र प्रोत्साहन दिइएको",
              inclusiveness: item.inclusiveness || "सबै विद्यार्थीलाई समान र समावेशी अवसर",
              assessmentMethods: Array.isArray(item.assessmentMethods) ? item.assessmentMethods : [FORMATIVE_ASSESSMENT_OPTIONS[0]],
              comprehensionLevel: item.comprehensionLevel || "अधिकांश विद्यार्थीले पाठको उद्देश्य स्पष्ट बुझेको",
              immediateFeedback: item.immediateFeedback || "तत्काल मौखिक पृष्ठपोषण दिइएको",
              homeworkAssigned: item.homeworkAssigned || "सान्दर्भिक गृहकार्य / अभ्यास कार्य दिइयो",
              overallGrade: item.overallGrade || "A",
            }));
            setLogs(upgraded);
          }
        } else {
          setLogs([]);
        }
      }
    } catch {
      setLogs([]);
    }

    // 2. Monthly reviews
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

    // 3. Meetings
    try {
      const rawMeet = localStorage.getItem(meetingsStorageKey);
      if (rawMeet) {
        const parsedMeet = JSON.parse(rawMeet);
        if (Array.isArray(parsedMeet)) setMeetings(parsedMeet);
      } else {
        setMeetings([]);
      }
    } catch {
      setMeetings([]);
    }
  }, [dept, deptName, storageKey, reviewStorageKey, meetingsStorageKey]);

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

  const saveMeetings = (newMeetings: DeptMeeting[]) => {
    setMeetings(newMeetings);
    try {
      localStorage.setItem(meetingsStorageKey, JSON.stringify(newMeetings));
    } catch {
      /* ignore */
    }
  };

  const deptClasses = lk.classes.filter((c) => c.department_id === dept);

  // Toggle multi-select array values
  const toggleArrayItem = (list: string[], item: string): string[] => {
    if (list.includes(item)) {
      return list.filter((x) => x !== item);
    }
    return [...list, item];
  };

  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacherName || !form.topic) {
      alert("कृपया शिक्षकको नाम र पाठ शीर्षक भर्नुहोस्।");
      return;
    }

    if (form.id) {
      const updated = logs.map((l) => (l.id === form.id ? ({ ...l, ...form } as ObservationLog) : l));
      saveLogs(updated);
    } else {
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
        duration: form.duration || "४५ मिनेट",
        methods: Array.isArray(form.methods) && form.methods.length > 0 ? form.methods : [TEACHING_METHODS_OPTIONS[0]],
        otherMethod: form.otherMethod || "",
        materials: Array.isArray(form.materials) && form.materials.length > 0 ? form.materials : [TEACHING_MATERIALS_OPTIONS[0]],
        otherMaterial: form.otherMaterial || "",
        punctuality: form.punctuality || "समयमै कक्षा प्रवेश तथा समयमै समापन (Punctual entry & exit)",
        timePacing: form.timePacing || "सन्तुलित समय विभाजन (Well-balanced pacing)",
        discipline: form.discipline || "अनुशासित, शान्त र सिकाइमैत्री (Disciplined & conducive)",
        boardWork: form.boardWork || "सफा, स्पष्ट र बुँदागत (Clear & well-organized)",
        engagementLevel: form.engagementLevel || "उच्च (८०%+ विद्यार्थी सक्रिय र जिज्ञासु)",
        questioningOpportunity: form.questioningOpportunity || "विद्यार्थीलाई प्रशस्त अवसर र प्रोत्साहन दिइएको",
        inclusiveness: form.inclusiveness || "सबै विद्यार्थीलाई समान र समावेशी अवसर",
        assessmentMethods: Array.isArray(form.assessmentMethods) && form.assessmentMethods.length > 0 ? form.assessmentMethods : [FORMATIVE_ASSESSMENT_OPTIONS[0]],
        comprehensionLevel: form.comprehensionLevel || "अधिकांश विद्यार्थीले पाठको उद्देश्य स्पष्ट बुझेको",
        immediateFeedback: form.immediateFeedback || "तत्काल मौखिक पृष्ठपोषण दिइएको",
        homeworkAssigned: form.homeworkAssigned || "सान्दर्भिक गृहकार्य / अभ्यास कार्य दिइयो",
        homeworkDetail: form.homeworkDetail || "",
        strengths: form.strengths || "",
        suggestions: form.suggestions || "",
        overallGrade: form.overallGrade || "A",
        observerName: form.observerName || profile?.name || "",
        observerRole: form.observerRole || "Head of Department",
        teacherFeedback: form.teacherFeedback || "",
      };
      saveLogs([newEntry, ...logs]);
    }

    setIsEditing(false);
  };

  const handleSaveMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.decisions) {
      alert("कृपया बैठकको विषय र मुख्य निर्णयहरू भर्नुहोस्।");
      return;
    }

    if (meetingForm.id) {
      const updated = meetings.map((m) => (m.id === meetingForm.id ? ({ ...m, ...meetingForm } as DeptMeeting) : m));
      saveMeetings(updated);
    } else {
      const newM: DeptMeeting = {
        id: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        deptId: dept,
        year,
        meetingNo: meetingForm.meetingNo || String(meetings.length + 1),
        date: meetingForm.date || todayBs(),
        title: meetingForm.title || "",
        chairperson: meetingForm.chairperson || profile?.name || "",
        presentMembers: meetingForm.presentMembers || [],
        agendas: meetingForm.agendas || "",
        decisions: meetingForm.decisions || "",
        actionPlan: meetingForm.actionPlan || "",
      };
      saveMeetings([newM, ...meetings]);
    }

    setIsEditingMeeting(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tabs / View Switcher */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="inline-flex rounded-lg bg-secondary p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === "observations" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setSubTab("observations");
              setSinglePrint(null);
              setSinglePrintMeeting(null);
            }}
          >
            📋 Class Observation Logs · कक्षा अवलोकन फारम ({logs.length})
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === "reviews" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setSubTab("reviews");
              setSinglePrint(null);
              setSinglePrintMeeting(null);
            }}
          >
            🔍 Monthly Report Review · मासिक प्रतिवेदन समीक्षा
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === "meetings" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setSubTab("meetings");
              setSinglePrint(null);
              setSinglePrintMeeting(null);
            }}
          >
            📝 Department Meetings · विभागीय बैठक र निर्णय ({meetings.length})
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
                  duration: "४५ मिनेट",
                  methods: [TEACHING_METHODS_OPTIONS[0], TEACHING_METHODS_OPTIONS[1]],
                  materials: [TEACHING_MATERIALS_OPTIONS[0]],
                  punctuality: "समयमै कक्षा प्रवेश तथा समयमै समापन (Punctual entry & exit)",
                  timePacing: "सन्तुलित समय विभाजन (Well-balanced pacing)",
                  discipline: "अनुशासित, शान्त र सिकाइमैत्री (Disciplined & conducive)",
                  boardWork: "सफा, स्पष्ट र बुँदागत (Clear & well-organized)",
                  engagementLevel: "उच्च (८०%+ विद्यार्थी सक्रिय र जिज्ञासु)",
                  questioningOpportunity: "विद्यार्थीलाई प्रशस्त अवसर र प्रोत्साहन दिइएको",
                  inclusiveness: "सबै विद्यार्थीलाई समान र समावेशी अवसर",
                  assessmentMethods: [FORMATIVE_ASSESSMENT_OPTIONS[0]],
                  comprehensionLevel: "अधिकांश विद्यार्थीले पाठको उद्देश्य स्पष्ट बुझेको",
                  immediateFeedback: "तत्काल मौखिक पृष्ठपोषण दिइएको",
                  homeworkAssigned: "सान्दर्भिक गृहकार्य / अभ्यास कार्य दिइयो",
                  strengths: "",
                  suggestions: "",
                  overallGrade: "A",
                  observerName: profile?.name || "",
                  observerRole: admin ? "Campus Chief / Administration" : "Head of Department",
                  teacherFeedback: "",
                });
                setIsEditing(true);
                setSinglePrint(null);
              }}
            >
              + नयाँ कक्षा अवलोकन (New Observation)
            </button>
          )}

          {subTab === "meetings" && canManage && !isEditingMeeting && (
            <button
              type="button"
              className="btn btn-primary !py-1 !px-3 text-xs"
              onClick={() => {
                setMeetingForm({
                  meetingNo: String(meetings.length + 1),
                  date: todayBs(),
                  title: "",
                  chairperson: profile?.name || "",
                  presentMembers: teachers.map((t) => t.name),
                  agendas: "",
                  decisions: "",
                  actionPlan: "",
                });
                setIsEditingMeeting(true);
                setSinglePrintMeeting(null);
              }}
            >
              + नयाँ बैठक तथा निर्णय (New Meeting)
            </button>
          )}

          <PrintBtn />
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. VIEW: CLASS OBSERVATION LOGS (WITH EXPANDED RUBRIC)        */}
      {/* ============================================================== */}
      {subTab === "observations" && (
        <>
          {/* Detailed Form Modal/Panel */}
          {isEditing && (
            <section className="no-print panel mb-4 rounded-2xl border border-primary/40 bg-card p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div>
                  <h3 className="font-bold text-lg text-primary">
                    {form.id ? "कक्षा शिक्षण अवलोकन सम्पादन (Edit Observation)" : "कक्षा शिक्षण अवलोकन तथा मूल्याङ्कन फारम (Classroom Observation Rubric)"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    त्रिभुवन विश्वविद्यालय तथा म्याग्दी बहुमुखी क्याम्पसको गुणस्तर सुधार (QAA) मापदण्ड अनुसारको विस्तृत मूल्याङ्कन फारम
                  </p>
                </div>
                <button type="button" className="btn-soft !py-1 !px-2.5 text-xs" onClick={() => setIsEditing(false)}>
                  ✕ बन्द गर्नुहोस् (Close)
                </button>
              </div>

              <form onSubmit={handleSaveObservation} className="space-y-5 text-xs">
                {/* खण्ड १: आधारभूत विवरण */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <span>१. आधारभूत विवरण (General Information)</span>
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="lbl">अवलोकन मिति (BS Date) *</label>
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
                      <label className="lbl">शिक्षकको नाम (Teacher Name) *</label>
                      {teachers.length > 0 ? (
                        <select
                          className="field font-semibold text-primary"
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
                          className="field font-semibold text-primary"
                          placeholder="शिक्षकको नाम"
                          value={form.teacherName || ""}
                          onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                          required
                        />
                      )}
                    </div>
                    <div>
                      <label className="lbl">कक्षा / तह (Class / Level) *</label>
                      <input
                        type="text"
                        className="field"
                        placeholder="e.g. Bachelor 1st Year (BBS I)"
                        value={form.className || ""}
                        onChange={(e) => setForm({ ...form, className: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="lbl">विषय र कोड (Subject & Code)</label>
                      <input
                        type="text"
                        className="field"
                        placeholder="e.g. Research Methodology (MGT 521)"
                        value={form.subject || ""}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="lbl">पाठ्यांश / पाठ शीर्षक (Lesson Topic / Sub-topic) *</label>
                      <input
                        type="text"
                        className="field font-semibold text-foreground"
                        placeholder="e.g. Concept and Meaning of Research"
                        value={form.topic || ""}
                        onChange={(e) => setForm({ ...form, topic: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="lbl">अवलोकन गरिएको अवधि (Duration)</label>
                      <input
                        type="text"
                        className="field"
                        placeholder="e.g. ४५ मिनेट / ५५ मिनेट"
                        value={form.duration || "४५ मिनेट"}
                        onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* खण्ड २: शिक्षण विधि (Multi-select) */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-foreground">
                      २. प्रयोग गरिएका शिक्षण विधिहरू (Teaching Methods Used)
                    </h4>
                    <span className="text-[11px] text-primary font-medium">✓ एक भन्दा बढी टिक लगाउन सकिने</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {TEACHING_METHODS_OPTIONS.map((m) => {
                      const isChecked = (form.methods || []).includes(m);
                      return (
                        <label
                          key={m}
                          className={`flex items-start gap-2 rounded-lg border p-2 transition cursor-pointer ${
                            isChecked ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-input"
                            checked={isChecked}
                            onChange={() => setForm({ ...form, methods: toggleArrayItem(form.methods || [], m) })}
                          />
                          <span>{m}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <input
                      type="text"
                      className="field !text-xs mt-1"
                      placeholder="अन्य कुनै विशेष विधि प्रयोग भएको भए उल्लेख गर्नुहोस्..."
                      value={form.otherMethod || ""}
                      onChange={(e) => setForm({ ...form, otherMethod: e.target.value })}
                    />
                  </div>
                </div>

                {/* खण्ड ३: शिक्षण सामग्री तथा प्रविधि (Multi-select) */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-foreground">
                      ३. प्रयोग गरिएका शिक्षण सामग्री तथा प्रविधि (Teaching Materials & Media)
                    </h4>
                    <span className="text-[11px] text-primary font-medium">✓ एक भन्दा बढी टिक लगाउन सकिने</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {TEACHING_MATERIALS_OPTIONS.map((mat) => {
                      const isChecked = (form.materials || []).includes(mat);
                      return (
                        <label
                          key={mat}
                          className={`flex items-start gap-2 rounded-lg border p-2 transition cursor-pointer ${
                            isChecked ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-input"
                            checked={isChecked}
                            onChange={() => setForm({ ...form, materials: toggleArrayItem(form.materials || [], mat) })}
                          />
                          <span>{mat}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <input
                      type="text"
                      className="field !text-xs mt-1"
                      placeholder="अन्य सामग्री / सफ्टवेयर / सन्दर्भ स्रोत..."
                      value={form.otherMaterial || ""}
                      onChange={(e) => setForm({ ...form, otherMaterial: e.target.value })}
                    />
                  </div>
                </div>

                {/* खण्ड ४: समयको पालना तथा कक्षा व्यवस्थापन */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                  <h4 className="font-bold text-sm text-foreground">
                    ४. समयको पालना तथा कक्षा व्यवस्थापन (Time Management & Discipline)
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <div>
                      <label className="lbl">समयको पालना (Punctuality)</label>
                      <select
                        className="field"
                        value={form.punctuality}
                        onChange={(e) => setForm({ ...form, punctuality: e.target.value })}
                      >
                        <option value="समयमै कक्षा प्रवेश तथा समयमै समापन (Punctual entry & exit)">समयमै कक्षा प्रवेश तथा समापन</option>
                        <option value="केही मिनेट ढिलो प्रवेश वा चाँडो समापन (Minor delay)">केही मिनेट ढिलो प्रवेश / समापन</option>
                        <option value="अनियमित / ढिलो (Not punctual)">अनियमित वा ढिलो</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">समय विभाजन (Pacing & Allocation)</label>
                      <select
                        className="field"
                        value={form.timePacing}
                        onChange={(e) => setForm({ ...form, timePacing: e.target.value })}
                      >
                        <option value="सन्तुलित समय विभाजन (Well-balanced pacing)">सन्तुलित समय विभाजन (Well-balanced)</option>
                        <option value="सामान्य समय विभाजन (Moderate pacing)">सामान्य समय विभाजन</option>
                        <option value="असन्तुलित / हतार गरिएको (Poor pacing)">असन्तुलित / हतार गरिएको</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">कक्षाकोठा अनुशासन र वातावरण</label>
                      <select
                        className="field"
                        value={form.discipline}
                        onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                      >
                        <option value="अनुशासित, शान्त र सिकाइमैत्री (Disciplined & conducive)">अनुशासित र सिकाइमैत्री</option>
                        <option value="सामान्य अनुशासन (Fair control)">सामान्य अनुशासन</option>
                        <option value="सुधार आवश्यक (Disruptive / Needs control)">सुधार आवश्यक</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">बोर्ड कार्यको व्यवस्थितता (Board Work)</label>
                      <select
                        className="field"
                        value={form.boardWork}
                        onChange={(e) => setForm({ ...form, boardWork: e.target.value })}
                      >
                        <option value="सफा, स्पष्ट र बुँदागत (Clear & well-organized)">सफा, स्पष्ट र बुँदागत</option>
                        <option value="सामान्य (Acceptable)">सामान्य</option>
                        <option value="अव्यवस्थित (Disorganized)">अव्यवस्थित</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* खण्ड ५: विद्यार्थी सहभागिता तथा अन्तरक्रिया */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                  <h4 className="font-bold text-sm text-foreground">
                    ५. विद्यार्थी सहभागिता तथा अन्तरक्रिया (Student Engagement & Interactivity)
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="lbl">सहभागिताको स्तर (Engagement Level)</label>
                      <select
                        className="field"
                        value={form.engagementLevel}
                        onChange={(e) => setForm({ ...form, engagementLevel: e.target.value })}
                      >
                        <option value="उच्च (८०%+ विद्यार्थी सक्रिय र जिज्ञासु)">उच्च (८०%+ सक्रिय र जिज्ञासु)</option>
                        <option value="मध्यम (५०-८०% विद्यार्थी संलग्न)">मध्यम (५०-८०% संलग्न)</option>
                        <option value="न्यून (<५०% विद्यार्थी मात्र संलग्न / निष्क्रिय)">न्यून (निष्क्रिय / श्रोता मात्र)</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">प्रश्न सोध्ने तथा छलफल अवसर</label>
                      <select
                        className="field"
                        value={form.questioningOpportunity}
                        onChange={(e) => setForm({ ...form, questioningOpportunity: e.target.value })}
                      >
                        <option value="विद्यार्थीलाई प्रशस्त अवसर र प्रोत्साहन दिइएको">प्रशस्त अवसर र प्रोत्साहन</option>
                        <option value="सामान्य अवसर दिइएको">सामान्य अवसर</option>
                        <option value="एकपक्षीय / अवसर नदिइएको">एकपक्षीय / अवसर नदिइएको</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">समावेशी तथा लैङ्गिक सहभागिता</label>
                      <select
                        className="field"
                        value={form.inclusiveness}
                        onChange={(e) => setForm({ ...form, inclusiveness: e.target.value })}
                      >
                        <option value="सबै विद्यार्थीलाई समान र समावेशी अवसर">समान र समावेशी अवसर</option>
                        <option value="सुधार आवश्यक (केही मात्र अगाडि बढेका)">सुधार आवश्यक</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* खण्ड ६: विद्यार्थी मूल्याङ्कन तथा सिकाइ परीक्षण */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                  <h4 className="font-bold text-sm text-foreground">
                    ६. सिकाइ परीक्षण तथा विद्यार्थी मूल्याङ्कन (Assessment & Evaluation during Class)
                  </h4>

                  <div className="space-y-1.5">
                    <label className="lbl">कक्षामा प्रयोग गरिएका मूल्याङ्कन विधिहरू (Assessment Methods Used)</label>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {FORMATIVE_ASSESSMENT_OPTIONS.map((opt) => {
                        const isChecked = (form.assessmentMethods || []).includes(opt);
                        return (
                          <label
                            key={opt}
                            className={`flex items-start gap-2 rounded-lg border p-2 transition cursor-pointer ${
                              isChecked ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border bg-card"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-input"
                              checked={isChecked}
                              onChange={() => setForm({ ...form, assessmentMethods: toggleArrayItem(form.assessmentMethods || [], opt) })}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div>
                      <label className="lbl">विद्यार्थीको बुझाइको स्तर (Comprehension)</label>
                      <select
                        className="field"
                        value={form.comprehensionLevel}
                        onChange={(e) => setForm({ ...form, comprehensionLevel: e.target.value })}
                      >
                        <option value="अधिकांश विद्यार्थीले पाठको उद्देश्य स्पष्ट बुझेको">अधिकांशले स्पष्ट बुझेको (High)</option>
                        <option value="मध्यम स्तरको बुझाइ (थप स्पष्टता आवश्यक)">मध्यम स्तरको बुझाइ (Average)</option>
                        <option value="धेरैमा द्विविधा / पुनः शिक्षण आवश्यक">पुनः शिक्षण आवश्यक (Low)</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">तत्काल पृष्ठपोषण (Immediate Feedback)</label>
                      <select
                        className="field"
                        value={form.immediateFeedback}
                        onChange={(e) => setForm({ ...form, immediateFeedback: e.target.value })}
                      >
                        <option value="तत्काल मौखिक पृष्ठपोषण दिइएको">तत्काल सच्याइ र पृष्ठपोषण दिइयो</option>
                        <option value="आंशिक पृष्ठपोषण दिइएको">आंशिक पृष्ठपोषण</option>
                        <option value="पृष्ठपोषण नदिइएको">पृष्ठपोषण नदिइएको</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">गृहकार्य / असाइनमेन्ट / स्व-अध्ययन</label>
                      <select
                        className="field"
                        value={form.homeworkAssigned}
                        onChange={(e) => setForm({ ...form, homeworkAssigned: e.target.value })}
                      >
                        <option value="सान्दर्भिक गृहकार्य / अभ्यास कार्य दिइयो">सान्दर्भिक गृहकार्य दिइयो</option>
                        <option value="आगामी कक्षाको पूर्वतयारी निर्देशन दिइयो">पूर्वतयारी निर्देशन दिइयो</option>
                        <option value="कुनै कार्य दिइएन">कुनै कार्य दिइएन</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* खण्ड ७: सबल पक्ष तथा सुधारका ठोस सुझावहरू */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-1.5">
                    <label className="font-bold text-sm text-foreground">
                      ७. सबल पक्षहरू / राम्रा अभ्यासहरू (Major Strengths Observed)
                    </label>
                    <textarea
                      rows={3}
                      className="field !text-xs font-medium"
                      placeholder="शिक्षकको विषयवस्तुको ज्ञान, प्रस्तुतिकरण कला, स्पष्टता, प्रविधिको सफल प्रयोग, विद्यार्थी आकर्षण..."
                      value={form.strengths || ""}
                      onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                    />
                  </div>

                  <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-1.5">
                    <label className="font-bold text-sm text-foreground">
                      ८. सुधारका क्षेत्र तथा ठोस सुझावहरू (Actionable Suggestions)
                    </label>
                    <textarea
                      rows={3}
                      className="field !text-xs font-medium"
                      placeholder="आगामी दिनमा शिक्षणलाई थप प्रभावकारी बनाउन शिक्षकलाई दिइएका व्यावहारिक सुझावहरू..."
                      value={form.suggestions || ""}
                      onChange={(e) => setForm({ ...form, suggestions: e.target.value })}
                    />
                  </div>
                </div>

                {/* खण्ड ८: समग्र ग्रेड तथा हस्ताक्षर */}
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
                  <h4 className="font-bold text-sm text-foreground">
                    ९. समग्र स्तर निर्धारण तथा पर्यवेक्षक विवरण (Overall Rating & Sign-off)
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <label className="lbl">समग्र स्तर (Overall Grade) *</label>
                      <select
                        className="field font-bold text-primary"
                        value={form.overallGrade || "A"}
                        onChange={(e) => setForm({ ...form, overallGrade: e.target.value as any })}
                      >
                        <option value="A">Grade A — उत्कृष्ट (Excellent)</option>
                        <option value="B">Grade B — राम्रो (Good)</option>
                        <option value="C">Grade C — सन्तोषजनक (Satisfactory)</option>
                        <option value="D">Grade D — सुधार आवश्यक (Needs Improvement)</option>
                      </select>
                    </div>

                    <div>
                      <label className="lbl">पर्यवेक्षकको नाम (Observer Name)</label>
                      <input
                        type="text"
                        className="field font-semibold"
                        value={form.observerName || profile?.name || ""}
                        onChange={(e) => setForm({ ...form, observerName: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="lbl">पर्यवेक्षकको पद (Designation)</label>
                      <input
                        type="text"
                        className="field"
                        value={form.observerRole || "Head of Department"}
                        onChange={(e) => setForm({ ...form, observerRole: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="lbl">शिक्षकको संक्षिप्त प्रतिक्रिया (Teacher Note)</label>
                      <input
                        type="text"
                        className="field"
                        placeholder="सुझावप्रति शिक्षकको प्रतिक्रिया..."
                        value={form.teacherFeedback || ""}
                        onChange={(e) => setForm({ ...form, teacherFeedback: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <button type="button" className="btn-soft" onClick={() => setIsEditing(false)}>
                    रद्द गर्नुहोस् (Cancel)
                  </button>
                  <button type="submit" className="btn btn-primary !px-5 font-bold">
                    सुरक्षित गर्नुहोस् (Save Observation Log)
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Printable Official Rubric Sheet */}
          {singlePrint && (
            <section className="panel mb-4 shadow-xl border-primary/30">
              <div className="no-print mb-3 flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-xs text-primary">आधिकारिक कक्षा अवलोकन फारम (Official Observation Sheet Preview)</span>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary !py-1 !px-3 text-xs font-bold" onClick={() => window.print()}>
                    🖨️ प्रिन्ट गर्नुहोस् (Print)
                  </button>
                  <button type="button" className="btn-soft !py-1 !px-2.5 text-xs" onClick={() => setSinglePrint(null)}>
                    ✕ बन्द गर्नुहोस्
                  </button>
                </div>
              </div>

              <div className="p-2 sm:p-4">
                <PrintHead title={`कक्षा शिक्षण अवलोकन तथा मूल्याङ्कन प्रतिवेदन — ${deptName || "Department"}`} />

                <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 border-y border-border py-2.5 bg-muted/20">
                  <div>विभाग: <b>{deptName || "—"}</b></div>
                  <div>शैक्षिक सत्र: <b>{year}</b></div>
                  <div>अवलोकन मिति: <b>{fmtBs(singlePrint.date)}</b></div>
                  <div>समग्र स्तर: <b className="text-primary text-sm font-black">Grade {singlePrint.overallGrade}</b></div>
                </div>

                <table className="rtable text-xs mb-4 w-full">
                  <tbody>
                    <tr>
                      <td className="w-48 font-semibold bg-muted/30">सम्बन्धित शिक्षकको नाम</td>
                      <td className="font-bold text-primary text-sm">{singlePrint.teacherName}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30">कक्षा तथा विषय</td>
                      <td><b>{singlePrint.className || "—"}</b> — {singlePrint.subject || "—"} (अवधि: {singlePrint.duration})</td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30">पाठ्यांश / पाठ शीर्षक</td>
                      <td className="font-bold">{singlePrint.topic}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30 align-top">प्रयोग गरिएका शिक्षण विधिहरू</td>
                      <td>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {(singlePrint.methods || []).map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                          {singlePrint.otherMethod && <li>अन्य: {singlePrint.otherMethod}</li>}
                        </ul>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30 align-top">शिक्षण सामग्री तथा प्रविधि</td>
                      <td>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {(singlePrint.materials || []).map((mat) => (
                            <li key={mat}>{mat}</li>
                          ))}
                          {singlePrint.otherMaterial && <li>अन्य: {singlePrint.otherMaterial}</li>}
                        </ul>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30 align-top">समय व्यवस्थापन र अनुशासन</td>
                      <td>
                        <div>• समयको पालना: <b>{singlePrint.punctuality}</b></div>
                        <div>• समय विभाजन (Pacing): <b>{singlePrint.timePacing}</b></div>
                        <div>• कक्षा अनुशासन: <b>{singlePrint.discipline}</b></div>
                        <div>• बोर्ड कार्य: <b>{singlePrint.boardWork}</b></div>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30 align-top">विद्यार्थी सहभागिता</td>
                      <td>
                        <div>• सहभागिता स्तर: <b>{singlePrint.engagementLevel}</b></div>
                        <div>• अन्तरक्रिया अवसर: <b>{singlePrint.questioningOpportunity}</b></div>
                        <div>• समावेशी वातावरण: <b>{singlePrint.inclusiveness}</b></div>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30 align-top">सिकाइ परीक्षण तथा मूल्याङ्कन</td>
                      <td>
                        <div>• प्रयोग गरिएका विधि: <b>{(singlePrint.assessmentMethods || []).join(", ") || "—"}</b></div>
                        <div>• विद्यार्थीको बुझाइ स्तर: <b>{singlePrint.comprehensionLevel}</b></div>
                        <div>• तत्काल पृष्ठपोषण: <b>{singlePrint.immediateFeedback}</b></div>
                        <div>• गृहकार्य / अभ्यास कार्य: <b>{singlePrint.homeworkAssigned}</b></div>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30 align-top">सबल पक्षहरू (Strengths)</td>
                      <td className="whitespace-pre-line font-medium text-foreground">{singlePrint.strengths || "—"}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold bg-muted/30 align-top">सुधारका क्षेत्र तथा ठोस सुझावहरू</td>
                      <td className="whitespace-pre-line font-bold text-foreground">{singlePrint.suggestions || "—"}</td>
                    </tr>
                    {singlePrint.teacherFeedback && (
                      <tr>
                        <td className="font-semibold bg-muted/30 align-top">शिक्षकको प्रतिक्रिया</td>
                        <td className="whitespace-pre-line italic text-muted-foreground">{singlePrint.teacherFeedback}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <Signatures
                  roles={[
                    ["सम्बन्धित शिक्षक (Teacher Observed)", singlePrint.teacherName],
                    ["अवलोकनकर्ता / विभागीय प्रमुख (Observer / HOD)", `${singlePrint.observerName} (${singlePrint.observerRole})`],
                    ["क्याम्पस प्रमुख (Campus Chief)", profile?.chief || "Campus Chief"],
                  ]}
                />
              </div>
            </section>
          )}

          {/* List Table */}
          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-primary">कक्षा अवलोकन अभिलेख (Class Observation Logs)</h3>
                <p className="text-xs text-muted-foreground">
                  विभागका शिक्षकहरूको कक्षा अवलोकन, बहु-शिक्षण विधि, सामग्री, विद्यार्थी सहभागिता र सुझावहरूको अभिलेख
                </p>
              </div>
              <span className="chip-on text-xs">कुल अभिलेख: {logs.length}</span>
            </div>

            {logs.length === 0 ? (
              <div className="rounded-lg border border-border bg-secondary/30 p-6 text-center text-xs text-muted-foreground">
                <p className="font-medium">यो विभागमा अहिलेसम्म कुनै कक्षा अवलोकन अभिलेख राखिएको छैन।</p>
                {canManage && (
                  <p className="mt-1">
                    माथिको <b>+ नयाँ कक्षा अवलोकन</b> बटन थिचेर पहिलो विस्तृत अवलोकन फारम भर्नुहोस्।
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="rtable w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left">मिति</th>
                      <th className="p-2.5 text-left">शिक्षकको नाम</th>
                      <th className="p-2.5 text-left">कक्षा / विषय</th>
                      <th className="p-2.5 text-left">पाठ शीर्षक</th>
                      <th className="p-2.5 text-left">शिक्षण विधिहरू</th>
                      <th className="p-2.5 text-left">सहभागिता</th>
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
                          {l.className} {l.subject ? `(${l.subject})` : ""}
                        </td>
                        <td className="p-2.5 font-medium max-w-44 truncate">{l.topic}</td>
                        <td className="p-2.5 max-w-44 truncate text-muted-foreground">
                          {(l.methods || []).map((m) => m.split(" ")[0]).join(", ")}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span
                            className={
                              l.engagementLevel?.includes("८०%") || l.engagementLevel?.includes("उच्च")
                                ? "chip-on"
                                : "chip"
                            }
                          >
                            {l.engagementLevel?.split(" ")[0] || "सामान्य"}
                          </span>
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                            l.overallGrade === "A" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                            l.overallGrade === "B" ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" :
                            l.overallGrade === "C" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                            "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                          }`}>
                            Grade {l.overallGrade || "A"}
                          </span>
                        </td>
                        <td className="no-print p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="btn-soft !py-1 !px-2 text-[11px] font-semibold"
                              onClick={() => setSinglePrint(l)}
                              title="फारम हेर्नुहोस् तथा प्रिन्ट गर्नुहोस्"
                            >
                              View / Print
                            </button>
                            {canManage && (
                              <>
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
                                  className="btn-danger !py-1 !px-2 text-[11px]"
                                  onClick={() => {
                                    if (confirm("के तपाईं यो अवलोकन अभिलेख हटाउन निश्चित हुनुहुन्छ?")) {
                                      saveLogs(logs.filter((x) => x.id !== l.id));
                                    }
                                  }}
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

      {/* ============================================================== */}
      {/* 2. VIEW: MONTHLY REPORT REVIEW                                */}
      {/* ============================================================== */}
      {subTab === "reviews" && (
        <section className="panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-base text-primary">मासिक / आवधिक प्रतिवेदन समीक्षा (Monthly Report Review)</h3>
              <p className="text-xs text-muted-foreground">
                विभागीय शिक्षकहरूको मासिक शिक्षण प्रगति, कार्यघन्टा र डायरी विवरणको अनुगमन तथा विभागीय प्रमुखको समीक्षा टिप्पणी
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

      {/* ============================================================== */}
      {/* 3. VIEW: DEPARTMENT MEETINGS & MINUTES (NEW ESSENTIAL FEATURE)  */}
      {/* ============================================================== */}
      {subTab === "meetings" && (
        <>
          {/* Meeting Form */}
          {isEditingMeeting && (
            <section className="no-print panel mb-4 rounded-xl border border-primary/40 bg-card p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="font-bold text-base text-primary">
                  {meetingForm.id ? "विभागीय बैठक सम्पादन (Edit Meeting)" : "नयाँ विभागीय बैठक तथा निर्णय (New Department Meeting & Minutes)"}
                </h3>
                <button type="button" className="btn-soft !py-1 !px-2 text-xs" onClick={() => setIsEditingMeeting(false)}>
                  ✕ बन्द गर्नुहोस्
                </button>
              </div>

              <form onSubmit={handleSaveMeeting} className="grid gap-3 sm:grid-cols-3 text-xs">
                <div>
                  <label className="lbl">बैठक संख्या (Meeting No.) *</label>
                  <input
                    type="text"
                    className="field font-bold"
                    value={meetingForm.meetingNo || "१"}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meetingNo: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">बैठक मिति (BS Date) *</label>
                  <input
                    type="text"
                    className="field font-bold"
                    placeholder="YYYY-MM-DD"
                    value={meetingForm.date || todayBs()}
                    onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="lbl">बैठकको अध्यक्षता (Chairperson)</label>
                  <input
                    type="text"
                    className="field"
                    value={meetingForm.chairperson || profile?.name || ""}
                    onChange={(e) => setMeetingForm({ ...meetingForm, chairperson: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="lbl">बैठकको विषय / शीर्षक (Meeting Title) *</label>
                  <input
                    type="text"
                    className="field font-semibold text-primary"
                    placeholder="e.g. प्रथम त्रैमासिक परीक्षा समीक्षा तथा कक्षा अवलोकन छलफल बैठक"
                    value={meetingForm.title || ""}
                    onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="lbl">उपस्थित शिक्षकहरू (Present Members - अल्पविरामले छुट्याउनुहोस्)</label>
                  <input
                    type="text"
                    className="field"
                    placeholder="e.g. Bishnu Acharya, Pashupatinath Dhakal, Shreedhar Subedi..."
                    value={(meetingForm.presentMembers || []).join(", ")}
                    onChange={(e) =>
                      setMeetingForm({
                        ...meetingForm,
                        presentMembers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="lbl">छलफलका कार्यसूचीहरू (Agendas)</label>
                  <textarea
                    rows={2}
                    className="field"
                    placeholder="१. पाठ्यांश प्रगति समीक्षा, २. आन्तरिक परीक्षा मिति निर्धारण, ३. अतिरिक्त कक्षा सञ्चालन..."
                    value={meetingForm.agendas || ""}
                    onChange={(e) => setMeetingForm({ ...meetingForm, agendas: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="lbl">गरिएका मुख्य निर्णयहरू (Key Decisions Taken) *</label>
                  <textarea
                    rows={4}
                    className="field font-medium text-foreground"
                    placeholder="निर्णय नं. १: ...&#10;निर्णय नं. २: ..."
                    value={meetingForm.decisions || ""}
                    onChange={(e) => setMeetingForm({ ...meetingForm, decisions: e.target.value })}
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="lbl">कार्यान्वयन योजना तथा जिम्मेवारी (Action Plan & Responsibility)</label>
                  <textarea
                    rows={2}
                    className="field"
                    placeholder="कार्य, जिम्मेवार व्यक्ति र समयसीमा..."
                    value={meetingForm.actionPlan || ""}
                    onChange={(e) => setMeetingForm({ ...meetingForm, actionPlan: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button type="button" className="btn-soft" onClick={() => setIsEditingMeeting(false)}>
                    रद्द गर्नुहोस्
                  </button>
                  <button type="submit" className="btn btn-primary font-bold">
                    निर्णय सुरक्षित गर्नुहोस् (Save Minutes)
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Single Meeting Print Sheet */}
          {singlePrintMeeting && (
            <section className="panel mb-4 shadow-xl border-primary/30">
              <div className="no-print mb-3 flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-xs text-primary">विभागीय बैठक माइन्युट पूर्वावलोकन (Minutes Print Preview)</span>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary !py-1 !px-3 text-xs font-bold" onClick={() => window.print()}>
                    🖨️ प्रिन्ट गर्नुहोस् (Print)
                  </button>
                  <button type="button" className="btn-soft !py-1 !px-2.5 text-xs" onClick={() => setSinglePrintMeeting(null)}>
                    ✕ बन्द गर्नुहोस्
                  </button>
                </div>
              </div>

              <div className="p-2 sm:p-4">
                <PrintHead title={`विभागीय बैठकको निर्णय पुस्तिका (Meeting Minutes) — ${deptName || "Department"}`} />

                <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 border-y border-border py-2.5 bg-muted/20">
                  <div>विभाग: <b>{deptName || "—"}</b></div>
                  <div>शैक्षिक सत्र: <b>{year}</b></div>
                  <div>बैठक संख्या: <b>नं. {singlePrintMeeting.meetingNo}</b></div>
                  <div>मिति: <b>{fmtBs(singlePrintMeeting.date)}</b></div>
                </div>

                <div className="mb-3">
                  <h4 className="font-bold text-sm text-primary mb-1">{singlePrintMeeting.title}</h4>
                  <div className="text-xs text-muted-foreground">अध्यक्षता: <b>{singlePrintMeeting.chairperson}</b></div>
                </div>

                <div className="space-y-3 text-xs mb-6">
                  <div className="rounded-lg border border-border p-3">
                    <div className="font-bold text-foreground mb-1">उपस्थित सदस्यहरू:</div>
                    <div>{(singlePrintMeeting.presentMembers || []).join(" · ") || "सबै विभागीय सदस्यहरू"}</div>
                  </div>

                  {singlePrintMeeting.agendas && (
                    <div className="rounded-lg border border-border p-3">
                      <div className="font-bold text-foreground mb-1">छलफलका कार्यसूचीहरू (Agendas):</div>
                      <div className="whitespace-pre-line">{singlePrintMeeting.agendas}</div>
                    </div>
                  )}

                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="font-bold text-primary mb-1">पारित निर्णयहरू (Decisions):</div>
                    <div className="whitespace-pre-line font-medium leading-relaxed">{singlePrintMeeting.decisions}</div>
                  </div>

                  {singlePrintMeeting.actionPlan && (
                    <div className="rounded-lg border border-border p-3">
                      <div className="font-bold text-foreground mb-1">कार्यान्वयन योजना (Action Plan):</div>
                      <div className="whitespace-pre-line">{singlePrintMeeting.actionPlan}</div>
                    </div>
                  )}
                </div>

                <Signatures
                  roles={[
                    ["विभागीय प्रमुख / संयोजक (HOD / Chair)", singlePrintMeeting.chairperson],
                    ["क्याम्पस प्रशासन (Administration)", profile?.chief || "Campus Chief"],
                  ]}
                />
              </div>
            </section>
          )}

          {/* Meetings List */}
          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-primary">विभागीय बैठक तथा निर्णय अभिलेख (Departmental Meetings & Minutes)</h3>
                <p className="text-xs text-muted-foreground">
                  विभागका नियमित मासिक बैठक, निर्णय तथा कार्यान्वयन कार्ययोजनाको आधिकारिक अभिलेख
                </p>
              </div>
              <span className="chip-on text-xs">कुल बैठक: {meetings.length}</span>
            </div>

            {meetings.length === 0 ? (
              <div className="rounded-lg border border-border bg-secondary/30 p-6 text-center text-xs text-muted-foreground">
                <p className="font-medium">यो शैक्षिक सत्रमा अहिलेसम्म कुनै विभागीय बैठक दर्ता भएको छैन।</p>
                {canManage && (
                  <p className="mt-1">
                    माथिको <b>+ नयाँ बैठक तथा निर्णय</b> बटन थिचेर पहिलो बैठकको माइन्युट राख्नुहोस्।
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="rtable w-full text-xs">
                  <thead>
                    <tr>
                      <th className="p-2.5 text-left">बैठक नं.</th>
                      <th className="p-2.5 text-left">मिति</th>
                      <th className="p-2.5 text-left">बैठकको विषय</th>
                      <th className="p-2.5 text-left">अध्यक्षता</th>
                      <th className="p-2.5 text-left">निर्णय सारांश</th>
                      <th className="no-print p-2.5 text-right">कार्य</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/40 transition">
                        <td className="p-2.5 font-bold text-primary whitespace-nowrap">बैठक #{m.meetingNo}</td>
                        <td className="p-2.5 whitespace-nowrap font-medium">{fmtBs(m.date)}</td>
                        <td className="p-2.5 font-semibold text-foreground max-w-56 truncate">{m.title}</td>
                        <td className="p-2.5 text-muted-foreground whitespace-nowrap">{m.chairperson}</td>
                        <td className="p-2.5 max-w-64 truncate text-muted-foreground">{m.decisions}</td>
                        <td className="no-print p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="btn-soft !py-1 !px-2 text-[11px] font-semibold"
                              onClick={() => setSinglePrintMeeting(m)}
                              title="माइन्युट हेर्नुहोस् तथा प्रिन्ट गर्नुहोस्"
                            >
                              View / Print
                            </button>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  className="btn-soft !py-1 !px-2 text-[11px]"
                                  onClick={() => {
                                    setMeetingForm(m);
                                    setIsEditingMeeting(true);
                                    setSinglePrintMeeting(null);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger !py-1 !px-2 text-[11px]"
                                  onClick={() => {
                                    if (confirm("के तपाईं यो बैठक अभिलेख हटाउन निश्चित हुनुहुन्छ?")) {
                                      saveMeetings(meetings.filter((x) => x.id !== m.id));
                                    }
                                  }}
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
    </div>
  );
}
