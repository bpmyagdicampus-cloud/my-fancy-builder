import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, BsDate } from "@/components/app/ui";
import { useCloud } from "@/lib/cloud";
import { supabase } from "@/integrations/supabase/client";
import { todayBs, fmtBs, monthKey, adToBs } from "@/lib/bs";
import { adminListUsers, type AdminUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/sqc")({
  head: () => ({ meta: [
    { title: "Student Quality Control (SQC) — Shikshak Diary" },
    { name: "description", content: "Student class monitoring records and reports for campus administration." },
  ] }),
  component: SQCPage,
});

const sb = supabase as any;
type Assignment = { id: string; student_id: string; class_name: string; academic_year: string; is_active: boolean; appointed_by: string; appointed_at: string; created_at: string };
type PeriodRecord = { id: string; assignment_id: string; record_date: string; period_number: number; subject: string; teacher_name: string; arrival_time: string; departure_time: string; class_status: string; total_students: number; present_students: number; absent_details: string; absence_notes: string; remarks: string; created_by: string; created_at: string };
type Issue = { id: string; assignment_id: string; title: string; category: string; description: string; priority: string; status: string; admin_response: string; reported_by: string; created_at: string };
type SQCReport = { id: string; assignment_id: string; period_type: string; start_date: string; end_date: string; summary: any; notes: string; submitted_by: string; status: string; admin_feedback: string; created_at: string };

const msg = (e: unknown) => e instanceof Error ? e.message : String((e as any)?.message ?? e);
const today = todayBs();
const currentMonth = monthKey(Number(today.split("-")[0]), Number(today.split("-")[1]) - 1);
const PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const STATUS: Record<string, string> = { held: "कक्षा सञ्चालन भयो", partial: "आंशिक सञ्चालन", not_held: "कक्षा सञ्चालन भएन", substituted: "वैकल्पिक शिक्षक", changed: "समय/कक्षा परिवर्तन" };
const ISSUE_CATEGORIES = ["कक्षाकोठा/फर्निचर", "सरसफाइ", "पठनपाठन सामग्री", "समयतालिका", "कक्षा सञ्चालन", "विद्यार्थीको माग/सुझाव", "प्रयोगशाला/ICT", "अन्य"];
const PERIOD_TYPES = [{ value: "daily", label: "दैनिक" }, { value: "monthly", label: "मासिक" }, { value: "custom", label: "निश्चित अवधि" }];

function SQCPage() {
  const c = useCloud();
  const isAdmin = c.roles.includes("admin");
  const isStudent = c.roles.includes("student") && !isAdmin;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [records, setRecords] = useState<PeriodRecord[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reports, setReports] = useState<SQCReport[]>([]);
  const [tab, setTab] = useState<"daily" | "issues" | "reports" | "admin">("daily");
  const [assignmentForm, setAssignmentForm] = useState({ student_id: "", class_name: "", academic_year: "2083/84" });
  const [editRecord, setEditRecord] = useState<PeriodRecord | null>(null);
  const [editIssue, setEditIssue] = useState({ title: "", category: ISSUE_CATEGORIES[0]!, description: "", priority: "normal" });
  const [periodType, setPeriodType] = useState("monthly");
  const [reportFrom, setReportFrom] = useState(`${currentMonth}-01`);
  const [reportTo, setReportTo] = useState(today);
  const [reportNotes, setReportNotes] = useState("");
  const [adminReportEdit, setAdminReportEdit] = useState<Record<string, { status: string; feedback: string }>>({});
  const [adminIssueEdit, setAdminIssueEdit] = useState<Record<string, { status: string; response: string }>>({});

  const userName = useCallback((id: string) => users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.login || id.slice(0, 8), [users]);
  const selected = assignments.find((a) => a.id === selectedId) ?? assignments[0];

  const reload = useCallback(async () => {
    if (!c.userId || (!isAdmin && !isStudent)) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      let aQuery = sb.from("sqc_assignments").select("*").order("class_name", { ascending: true });
      if (!isAdmin) aQuery = aQuery.eq("student_id", c.userId).eq("is_active", true);
      const aRes = await aQuery;
      if (aRes.error) throw aRes.error;
      const aList = (aRes.data ?? []) as Assignment[];
      setAssignments(aList);
      if (isAdmin) {
        try { setUsers(await adminListUsers({ data: {} })); } catch (e) { throw new Error(`प्रयोगकर्ता सूची लोड हुन सकेन: ${msg(e)}`); }
      }
      if (!aList.length) {
        setRecords([]); setIssues([]); setReports([]); setSelectedId("");
        setLoading(false); return;
      }
      const ids = aList.map((a) => a.id);
      const [rRes, iRes, repRes] = await Promise.all([
        sb.from("sqc_period_records").select("*").in("assignment_id", ids).order("record_date", { ascending: false }).order("period_number", { ascending: true }),
        sb.from("sqc_issues").select("*").in("assignment_id", ids).order("created_at", { ascending: false }),
        sb.from("sqc_reports").select("*").in("assignment_id", ids).order("created_at", { ascending: false }),
      ]);
      if (rRes.error) throw rRes.error;
      if (iRes.error) throw iRes.error;
      if (repRes.error) throw repRes.error;
      setRecords((rRes.data ?? []) as PeriodRecord[]);
      setIssues((iRes.data ?? []) as Issue[]);
      setReports((repRes.data ?? []) as SQCReport[]);
      setSelectedId((old) => aList.some((a) => a.id === old) ? old : aList[0]!.id);
    } catch (e) { setError(msg(e)); }
    finally { setLoading(false); }
  }, [c.userId, isAdmin, isStudent]);

  useEffect(() => { void reload(); }, [reload]);

  const classRecords = useMemo(() => records.filter((r) => r.assignment_id === selected?.id), [records, selected]);
  const classIssues = useMemo(() => issues.filter((i) => i.assignment_id === selected?.id), [issues, selected]);
  const classReports = useMemo(() => reports.filter((r) => r.assignment_id === selected?.id), [reports, selected]);

  const savePeriod = async () => {
    if (!selected || !c.userId) return;
    const r = editRecord;
    if (!r) return;
    const total = Math.max(0, Number(r.total_students) || 0);
    const present = Math.max(0, Math.min(total, Number(r.present_students) || 0));
    if (!r.record_date || !r.period_number || !r.subject.trim() || !r.teacher_name.trim()) { setError("मिति, पिरियड, विषय र शिक्षकको नाम अनिवार्य छन्।"); return; }
    if (r.class_status === "held" && (!r.arrival_time || !r.departure_time)) { setError("कक्षा सञ्चालन भएको अवस्थामा शिक्षकको आगमन र प्रस्थान समय भर्नुहोस्।"); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = { assignment_id: selected.id, record_date: r.record_date, period_number: Number(r.period_number), subject: r.subject.trim(), teacher_name: r.teacher_name.trim(), arrival_time: r.arrival_time || null, departure_time: r.departure_time || null, class_status: r.class_status, total_students: total, present_students: present, absent_details: r.absent_details || "", absence_notes: r.absence_notes || "", remarks: r.remarks || "", created_by: c.userId, updated_at: new Date().toISOString() };
      const { error: e } = await sb.from("sqc_period_records").upsert(payload, { onConflict: "assignment_id,record_date,period_number" });
      if (e) throw e;
      setEditRecord(null); setNotice("दैनिक पिरियड अभिलेख सुरक्षित भयो।"); await reload();
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };

  const addIssue = async () => {
    if (!selected || !c.userId) return;
    if (!editIssue.title.trim() || !editIssue.description.trim()) { setError("समस्याको शीर्षक र विवरण भर्नुहोस्।"); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: e } = await sb.from("sqc_issues").insert({ assignment_id: selected.id, title: editIssue.title.trim(), category: editIssue.category, description: editIssue.description.trim(), priority: editIssue.priority, status: "submitted", reported_by: c.userId });
      if (e) throw e;
      setEditIssue({ title: "", category: ISSUE_CATEGORIES[0]!, description: "", priority: "normal" });
      setNotice("समस्या/सुझाव सिधै प्रशासनमा पेश भयो।"); await reload();
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };

  const submitReport = async () => {
    if (!selected || !c.userId) return;
    const from = periodType === "daily" ? reportTo : reportFrom;
    const to = periodType === "daily" ? reportTo : reportTo;
    if (!from || !to || from > to) { setError("प्रतिवेदनको मिति अवधि मिलाउनुहोस्।"); return; }
    const rs = classRecords.filter((r) => r.record_date >= from && r.record_date <= to);
    const is = classIssues.filter((i) => { const d = adToBs(new Date(i.created_at)); return d >= from && d <= to; });
    const held = rs.filter((r) => r.class_status === "held" || r.class_status === "substituted").length;
    const totalStudents = rs.reduce((n, r) => n + (Number(r.total_students) || 0), 0);
    const presentStudents = rs.reduce((n, r) => n + (Number(r.present_students) || 0), 0);
    const summary = { periodCount: rs.length, heldPeriods: held, notHeldPeriods: rs.filter((r) => r.class_status === "not_held").length, partialPeriods: rs.filter((r) => r.class_status === "partial").length, attendancePercent: totalStudents ? Math.round(presentStudents / totalStudents * 1000) / 10 : null, issueCount: is.length, periodRecords: rs.map((r) => ({ date: r.record_date, period: r.period_number, subject: r.subject, teacher: r.teacher_name, status: r.class_status, arrival: r.arrival_time, departure: r.departure_time, total: r.total_students, present: r.present_students, remarks: r.remarks })) };
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: e } = await sb.from("sqc_reports").insert({ assignment_id: selected.id, period_type: periodType, start_date: from, end_date: to, summary, notes: reportNotes, submitted_by: c.userId, status: "submitted" });
      if (e) throw e;
      setReportNotes(""); setNotice("प्रतिवेदन सिधै क्याम्पस प्रशासनमा पेश भयो।"); await reload();
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };

  const createAssignment = async () => {
    if (!assignmentForm.student_id || !assignmentForm.class_name.trim() || !assignmentForm.academic_year.trim() || !c.userId) { setError("विद्यार्थी, कक्षा र शैक्षिक सत्र छान्नुहोस्/भर्नुहोस्।"); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: e } = await sb.from("sqc_assignments").insert({ student_id: assignmentForm.student_id, class_name: assignmentForm.class_name.trim(), academic_year: assignmentForm.academic_year.trim(), appointed_by: c.userId, is_active: true });
      if (e) throw e;
      setAssignmentForm((v) => ({ ...v, class_name: "" })); setNotice("SQC प्रतिनिधि नियुक्त भयो।"); await reload();
    } catch (e) { setError(/duplicate|unique/i.test(msg(e)) ? "यो विद्यार्थी र कक्षाको नियुक्ति पहिले नै छ।" : msg(e)); }
    finally { setBusy(false); }
  };

  const deactivateAssignment = async (a: Assignment) => {
    if (!confirm(`${a.class_name} कक्षाको ${userName(a.student_id)} को SQC जिम्मेवारी समाप्त गर्ने? पुराना अभिलेख सुरक्षित रहनेछन्।`)) return;
    setBusy(true); setError("");
    try { const { error: e } = await sb.from("sqc_assignments").update({ is_active: false }).eq("id", a.id); if (e) throw e; setNotice("जिम्मेवारी समाप्त गरियो; पुराना अभिलेख सुरक्षित छन्।"); await reload(); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  const updateIssue = async (i: Issue) => {
    const v = adminIssueEdit[i.id] ?? { status: i.status, response: i.admin_response ?? "" };
    setBusy(true); setError("");
    try { const { error: e } = await sb.from("sqc_issues").update({ status: v.status, admin_response: v.response, updated_at: new Date().toISOString() }).eq("id", i.id); if (e) throw e; setNotice("समस्याको अवस्था अद्यावधिक भयो।"); await reload(); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  const updateReport = async (r: SQCReport) => {
    const v = adminReportEdit[r.id] ?? { status: r.status, feedback: r.admin_feedback ?? "" };
    setBusy(true); setError("");
    try { const { error: e } = await sb.from("sqc_reports").update({ status: v.status, admin_feedback: v.feedback, reviewed_at: new Date().toISOString() }).eq("id", r.id); if (e) throw e; setNotice("प्रतिवेदन समीक्षा सुरक्षित भयो।"); await reload(); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  if (!isAdmin && !isStudent) return <Page title="Student Quality Control (SQC)"><div className="panel">SQC सुविधा प्रशासन र नियुक्त विद्यार्थी प्रतिनिधिका लागि मात्र हो।</div></Page>;

  return <Page title="Student Quality Control (SQC)" sub={isAdmin ? "विद्यार्थी प्रतिनिधि नियुक्ति, कक्षा अनुगमन र प्रशासनिक प्रतिवेदन" : "दैनिक कक्षा अभिलेख र प्रतिवेदन सिधै क्याम्पस प्रशासनमा पेश गर्नुहोस्"} actions={<button className="btn-soft" onClick={() => void reload()} disabled={loading || busy}>↻ Refresh</button>}>
    {error && <div role="alert" className="mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{error}</div>}
    {notice && <div role="status" className="mb-3 rounded-md border border-primary/30 bg-secondary p-3 text-sm">{notice}</div>}
    {loading ? <div className="panel">SQC विवरण लोड हुँदैछ…</div> : <>
      {isAdmin && <section className="panel mb-4">
        <h2 className="mb-3 text-lg font-bold">प्रशासन · SQC प्रतिनिधि नियुक्ति</h2>
        <p className="mb-3 text-sm text-muted-foreground">प्रत्येक कक्षाका लागि एक वा बढी विद्यार्थी नियुक्त गर्न सकिन्छ। निष्क्रिय बनाउँदा पुराना अभिलेख मेटिँदैनन्।</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="lbl">विद्यार्थी प्रतिनिधि</label><select className="field" value={assignmentForm.student_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, student_id: e.target.value })}><option value="">— विद्यार्थी छान्नुहोस् —</option>{users.filter((u) => u.roles.includes("student") && !u.roles.includes("admin")).map((u) => <option key={u.id} value={u.id}>{u.name || u.login} · {u.login}</option>)}</select></div>
          <div><label className="lbl">कक्षा</label><input className="field" placeholder="जस्तै: BBS 1st Year A" value={assignmentForm.class_name} onChange={(e) => setAssignmentForm({ ...assignmentForm, class_name: e.target.value })}/></div>
          <div><label className="lbl">शैक्षिक सत्र</label><input className="field" value={assignmentForm.academic_year} onChange={(e) => setAssignmentForm({ ...assignmentForm, academic_year: e.target.value })}/></div>
          <div className="flex items-end"><button className="btn w-full" onClick={() => void createAssignment()} disabled={busy}>+ प्रतिनिधि नियुक्त गर्नुहोस्</button></div>
        </div>
        <h3 className="mb-2 mt-5 font-semibold">नियुक्ति विवरण ({assignments.length})</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">कक्षा</th><th className="p-2">प्रतिनिधि</th><th className="p-2">सत्र</th><th className="p-2">स्थिति</th><th className="p-2">कार्य</th></tr></thead><tbody>{assignments.map((a) => <tr className="border-b" key={a.id}><td className="p-2">{a.class_name}</td><td className="p-2">{userName(a.student_id)}</td><td className="p-2">{a.academic_year}</td><td className="p-2">{a.is_active ? "सक्रिय" : "निष्क्रिय"}</td><td className="p-2">{a.is_active && <button className="btn-danger" disabled={busy} onClick={() => void deactivateAssignment(a)}>जिम्मेवारी समाप्त</button>}</td></tr>)}{!assignments.length && <tr><td colSpan={5} className="p-3 text-muted-foreground">अहिलेसम्म प्रतिनिधि नियुक्त गरिएको छैन।</td></tr>}</tbody></table></div>
      </section>}

      {assignments.length > 0 ? <>
        <section className="panel mb-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div><label className="lbl">{isAdmin ? "अभिलेख हेर्ने कक्षा / प्रतिनिधि" : "मेरो जिम्मेवारीको कक्षा"}</label><select className="field" value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>{assignments.map((a) => <option key={a.id} value={a.id}>{a.class_name} · {a.academic_year}{isAdmin ? ` · ${userName(a.student_id)}` : ""}{!a.is_active ? " (निष्क्रिय)" : ""}</option>)}</select></div>
            <div className="flex flex-wrap gap-2">{([ ["daily", "दैनिक अभिलेख"], ["issues", "समस्या/माग"], ["reports", "प्रतिवेदन"] ] as const).map(([v, label]) => <button key={v} className={tab === v ? "tab-on" : "tab"} onClick={() => setTab(v)}>{label}</button>)}{isAdmin && <button className={tab === "admin" ? "tab-on" : "tab"} onClick={() => setTab("admin")}>प्रशासन समीक्षा</button>}</div>
          </div>
        </section>

        {(tab === "daily" || tab === "admin") && <section className="panel mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">दैनिक पिरियड अभिलेख · {classRecords.length}</h2>{!isAdmin && selected?.is_active && <button className="btn" onClick={() => setEditRecord({ id: "", assignment_id: selected.id, record_date: today, period_number: 1, subject: "", teacher_name: "", arrival_time: "", departure_time: "", class_status: "held", total_students: 0, present_students: 0, absent_details: "", absence_notes: "", remarks: "", created_by: c.userId!, created_at: "" })}>+ नयाँ पिरियड</button>}</div>
          {editRecord && !isAdmin && <div className="mb-4 rounded-lg border border-primary/30 bg-secondary/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className="lbl">मिति (वि.सं.)</label><BsDate value={editRecord.record_date} onChange={(v) => setEditRecord({ ...editRecord, record_date: v })}/></div>
              <div><label className="lbl">पिरियड</label><select className="field" value={editRecord.period_number} onChange={(e) => setEditRecord({ ...editRecord, period_number: Number(e.target.value) })}>{PERIODS.map((p) => <option key={p} value={p}>{p} औँ</option>)}</select></div>
              <div><label className="lbl">विषय</label><input className="field" value={editRecord.subject} onChange={(e) => setEditRecord({ ...editRecord, subject: e.target.value })}/></div>
              <div><label className="lbl">शिक्षकको नाम</label><input className="field" value={editRecord.teacher_name} onChange={(e) => setEditRecord({ ...editRecord, teacher_name: e.target.value })}/></div>
              <div><label className="lbl">शिक्षक आएको समय</label><input className="field" type="time" value={editRecord.arrival_time ?? ""} onChange={(e) => setEditRecord({ ...editRecord, arrival_time: e.target.value })}/></div>
              <div><label className="lbl">शिक्षक गएको समय</label><input className="field" type="time" value={editRecord.departure_time ?? ""} onChange={(e) => setEditRecord({ ...editRecord, departure_time: e.target.value })}/></div>
              <div><label className="lbl">कक्षा सञ्चालन अवस्था</label><select className="field" value={editRecord.class_status} onChange={(e) => setEditRecord({ ...editRecord, class_status: e.target.value })}>{Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="lbl">कुल विद्यार्थी संख्या</label><input className="field" type="number" min={0} value={editRecord.total_students} onChange={(e) => setEditRecord({ ...editRecord, total_students: Number(e.target.value) })}/></div>
              <div><label className="lbl">उपस्थित विद्यार्थी संख्या</label><input className="field" type="number" min={0} max={editRecord.total_students} value={editRecord.present_students} onChange={(e) => setEditRecord({ ...editRecord, present_students: Number(e.target.value) })}/><p className="mt-1 text-xs text-muted-foreground">अनुपस्थित: {Math.max(0, Number(editRecord.total_students) - Number(editRecord.present_students))}</p></div>
              <div className="sm:col-span-2 lg:col-span-3"><label className="lbl">अनुपस्थित विद्यार्थीको नाम/रोल नम्बर</label><textarea className="field min-h-16" value={editRecord.absent_details ?? ""} onChange={(e) => setEditRecord({ ...editRecord, absent_details: e.target.value })} placeholder="नाम वा रोल नम्बर, आवश्यक भएमा प्रत्येक लाइनमा एक जना"/></div>
              <div className="sm:col-span-2 lg:col-span-3"><label className="lbl">अनुपस्थितिको कारण (थाहा भएमा)</label><textarea className="field min-h-16" value={editRecord.absence_notes ?? ""} onChange={(e) => setEditRecord({ ...editRecord, absence_notes: e.target.value })}/></div>
              <div className="sm:col-span-2 lg:col-span-3"><label className="lbl">कैफियत / टिपोट</label><textarea className="field min-h-16" value={editRecord.remarks ?? ""} onChange={(e) => setEditRecord({ ...editRecord, remarks: e.target.value })}/></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2"><button className="btn" disabled={busy} onClick={() => void savePeriod()}>{busy ? "सुरक्षित हुँदैछ…" : "अभिलेख सुरक्षित गर्नुहोस्"}</button><button className="btn-soft" onClick={() => setEditRecord(null)}>रद्द गर्नुहोस्</button></div>
          </div>}
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">मिति</th><th className="p-2">पिरियड</th><th className="p-2">विषय/शिक्षक</th><th className="p-2">आएको</th><th className="p-2">गएको</th><th className="p-2">कक्षा अवस्था</th><th className="p-2">उपस्थिति</th><th className="p-2">कैफियत</th></tr></thead><tbody>{classRecords.map((r) => <tr key={r.id} className="border-b align-top"><td className="p-2">{fmtBs(r.record_date)}</td><td className="p-2">{r.period_number}</td><td className="p-2">{r.subject}<div className="text-xs text-muted-foreground">{r.teacher_name}</div></td><td className="p-2">{r.arrival_time || "—"}</td><td className="p-2">{r.departure_time || "—"}</td><td className="p-2">{STATUS[r.class_status] ?? r.class_status}</td><td className="p-2">{r.present_students}/{r.total_students}<div className="text-xs text-muted-foreground">अनुपस्थित {Math.max(0,r.total_students-r.present_students)}</div></td><td className="max-w-56 whitespace-pre-wrap p-2">{r.remarks || r.absence_notes || "—"}{!isAdmin && <button className="ml-2 underline" onClick={() => setEditRecord(r)}>सम्पादन</button>}</td></tr>)}{!classRecords.length && <tr><td colSpan={8} className="p-4 text-muted-foreground">अभिलेख छैन। {isAdmin ? "प्रतिनिधिले दैनिक विवरण राखेपछि यहाँ देखिन्छ।" : "नयाँ पिरियड बटनबाट सुरु गर्नुहोस्।"}</td></tr>}</tbody></table></div>
        </section>}

        {(tab === "issues" || tab === "admin") && <section className="panel mb-4">
          <h2 className="mb-3 text-lg font-bold">समस्या, गुनासा तथा माग · {classIssues.length}</h2>
          {!isAdmin && selected?.is_active && <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div><label className="lbl">शीर्षक</label><input className="field" value={editIssue.title} onChange={(e) => setEditIssue({ ...editIssue, title: e.target.value })} placeholder="समस्याको छोटो शीर्षक"/></div>
            <div><label className="lbl">वर्ग</label><select className="field" value={editIssue.category} onChange={(e) => setEditIssue({ ...editIssue, category: e.target.value })}>{ISSUE_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="lbl">प्राथमिकता</label><select className="field" value={editIssue.priority} onChange={(e) => setEditIssue({ ...editIssue, priority: e.target.value })}><option value="low">कम</option><option value="normal">सामान्य</option><option value="high">उच्च</option><option value="urgent">तत्काल</option></select></div>
            <div className="sm:col-span-2"><label className="lbl">विस्तृत विवरण / विद्यार्थीको माग</label><textarea className="field min-h-24" value={editIssue.description} onChange={(e) => setEditIssue({ ...editIssue, description: e.target.value })}/></div>
            <div className="sm:col-span-2"><button className="btn" disabled={busy} onClick={() => void addIssue()}>प्रशासनमा पेश गर्नुहोस्</button></div>
          </div>}
          <div className="space-y-3">{classIssues.map((i) => { const v = adminIssueEdit[i.id] ?? { status: i.status, response: i.admin_response ?? "" }; return <article key={i.id} className="rounded-lg border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{i.title}</h3><p className="text-xs text-muted-foreground">{i.category} · {new Date(i.created_at).toLocaleString()} · प्राथमिकता: {i.priority}{isAdmin ? ` · ${userName(assignments.find((a) => a.id === i.assignment_id)?.student_id ?? "")}` : ""}</p></div><span className="chip">{i.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{i.description}</p>{i.admin_response && <p className="mt-2 rounded bg-secondary p-2 text-sm">प्रशासनको प्रतिक्रिया: {i.admin_response}</p>}{isAdmin && <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select className="field" value={v.status} onChange={(e) => setAdminIssueEdit({ ...adminIssueEdit, [i.id]: { ...v, status: e.target.value } })}><option value="submitted">पेश भएको</option><option value="in_review">समीक्षामा</option><option value="in_progress">कार्य भइरहेको</option><option value="resolved">समाधान भएको</option><option value="rejected">कारबाही आवश्यक छैन</option></select><input className="field" placeholder="प्रशासनको प्रतिक्रिया" value={v.response} onChange={(e) => setAdminIssueEdit({ ...adminIssueEdit, [i.id]: { ...v, response: e.target.value } })}/><button className="btn-soft" disabled={busy} onClick={() => void updateIssue(i)}>अपडेट</button></div>}</article>; })}{!classIssues.length && <p className="text-sm text-muted-foreground">समस्या वा माग दर्ता भएको छैन।</p>}</div>
        </section>}

        {(tab === "reports" || tab === "admin") && <section className="panel mb-4">
          <h2 className="mb-3 text-lg font-bold">प्रतिवेदन · {classReports.length}</h2>
          {!isAdmin && selected?.is_active && <div className="mb-4 rounded-lg border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="lbl">प्रतिवेदनको प्रकार</label><select className="field" value={periodType} onChange={(e) => { const v=e.target.value; setPeriodType(v); if(v === "daily") setReportFrom(reportTo); else if(v === "monthly") setReportFrom(`${reportTo.slice(0,7)}-01`); }} >{PERIOD_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
              {periodType !== "daily" && <div><label className="lbl">सुरु मिति</label><BsDate value={reportFrom} onChange={setReportFrom}/></div>}
              <div><label className="lbl">{periodType === "daily" ? "प्रतिवेदन मिति" : "अन्तिम मिति"}</label><BsDate value={reportTo} onChange={setReportTo}/></div>
              <div className="sm:col-span-3"><label className="lbl">थप टिप्पणी</label><textarea className="field min-h-16" value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} placeholder="यस अवधिका मुख्य उपलब्धि, समस्या वा सुझाव"/></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">यस अवधिका {classRecords.filter((r) => r.record_date >= (periodType === "daily" ? reportTo : reportFrom) && r.record_date <= reportTo).length} पिरियड अभिलेख समावेश हुनेछन्। प्रतिवेदन सिधै प्रशासनमा पेश हुनेछ।</p>
            <button className="btn mt-3" disabled={busy} onClick={() => void submitReport()}>प्रतिवेदन प्रशासनमा पेश गर्नुहोस्</button>
          </div>}
          <div className="space-y-3">{classReports.map((r) => { const v = adminReportEdit[r.id] ?? { status: r.status, feedback: r.admin_feedback ?? "" }; const s = r.summary ?? {}; return <article key={r.id} className="rounded-lg border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{r.period_type === "daily" ? "दैनिक" : r.period_type === "monthly" ? "मासिक" : "अवधिगत"} प्रतिवेदन · {fmtBs(r.start_date)}{r.end_date !== r.start_date ? ` — ${fmtBs(r.end_date)}` : ""}</h3><p className="text-xs text-muted-foreground">पेश मिति: {new Date(r.created_at).toLocaleString()} · स्थिति: {r.status}</p></div><button className="btn-soft no-print" onClick={() => window.print()}>प्रिन्ट / PDF</button></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div className="rounded bg-secondary p-2">कुल पिरियड <b className="block text-lg">{s.periodCount ?? 0}</b></div><div className="rounded bg-secondary p-2">सञ्चालित <b className="block text-lg">{s.heldPeriods ?? 0}</b></div><div className="rounded bg-secondary p-2">नसञ्चालित <b className="block text-lg">{s.notHeldPeriods ?? 0}</b></div><div className="rounded bg-secondary p-2">औसत उपस्थिति <b className="block text-lg">{s.attendancePercent == null ? "—" : `${s.attendancePercent}%`}</b></div></div>{r.notes && <p className="mt-2 whitespace-pre-wrap text-sm">टिप्पणी: {r.notes}</p>}{r.admin_feedback && <p className="mt-2 rounded bg-secondary p-2 text-sm">प्रशासनको प्रतिक्रिया: {r.admin_feedback}</p>}{isAdmin && <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select className="field" value={v.status} onChange={(e) => setAdminReportEdit({ ...adminReportEdit, [r.id]: { ...v, status: e.target.value } })}><option value="submitted">पेश भएको</option><option value="reviewed">समीक्षा गरिएको</option><option value="needs_revision">सच्याउनुपर्ने</option></select><input className="field" placeholder="प्रशासनको प्रतिक्रिया" value={v.feedback} onChange={(e) => setAdminReportEdit({ ...adminReportEdit, [r.id]: { ...v, feedback: e.target.value } })}/><button className="btn-soft" disabled={busy} onClick={() => void updateReport(r)}>समीक्षा सुरक्षित गर्नुहोस्</button></div>}</article>; })}{!classReports.length && <p className="text-sm text-muted-foreground">प्रतिवेदन पेश गरिएको छैन।</p>}</div>
        </section>}
      </> : <section className="panel"><h2 className="font-semibold">{isAdmin ? "SQC प्रतिनिधि नियुक्त गर्न बाँकी छ" : "तपाईंलाई SQC प्रतिनिधि नियुक्त गरिएको छैन"}</h2><p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "माथिको फारामबाट विद्यार्थी र कक्षा छानेर नियुक्ति गर्नुहोस्।" : "क्याम्पस प्रशासनलाई आफ्नो कक्षाको SQC प्रतिनिधि नियुक्त गर्न अनुरोध गर्नुहोस्।"}</p></section>}
    </>}
  </Page>;
}
