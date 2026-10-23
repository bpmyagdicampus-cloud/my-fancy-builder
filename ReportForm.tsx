import { useState } from "react";
import { BsDate } from "@/components/app/ui";
import { todayBs } from "@/lib/bs";
import { saveReport, type Teacher } from "@/lib/sqc-data";
import { className, hhmm, validateReport, type Period, type Report, type ReportDraft, type SqcClass } from "@/lib/sqc";

const OTHER = "__other";

export function ReportForm({ classes, teachers, periods, initial, onSaved, onCancel }: {
  classes: SqcClass[]; teachers: Teacher[]; periods: Period[]; initial?: Report; onSaved: (r: Report) => void; onCancel?: () => void;
}) {
  const [d, setD] = useState<ReportDraft & { id?: string }>(() => initial ?? { class_id: classes.length === 1 ? classes[0]!.id : "", report_date: todayBs(), period_no: 1, held: true, teacher_id: null, teacher_name: "", subject: "" });
  const [other, setOther] = useState(!!initial && !initial.teacher_id && !!initial.teacher_name);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<ReportDraft>) => setD((x) => ({ ...x, ...p }));
  const per = periods.find((p) => p.period_no === Number(d.period_no));

  const submit = async () => {
    const v = validateReport(d);
    if (v) return setErr(v);
    setBusy(true); setErr("");
    const r = await saveReport(d);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    if (!r.data) return setErr("Saved, but the record could not be read back. Please refresh.");
    onSaved(r.data);
  };

  return (
    <div className="panel space-y-3">
      <h2 className="text-lg font-bold">{initial ? "Edit report · प्रतिवेदन सच्याउनुहोस्" : "New report · नयाँ प्रतिवेदन"}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="lbl">Class · कक्षा</label>
          <select className="field" value={d.class_id} disabled={!!initial} onChange={(e) => set({ class_id: e.target.value })}>
            <option value="">— Select —</option>{classes.map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}
          </select></div>
        <div><label className="lbl">Date · मिति</label><BsDate value={d.report_date ?? ""} onChange={(v) => set({ report_date: v })} /></div>
        <div><label className="lbl">Period · पिरियड {per && <span className="font-normal">({hhmm(per.start_time)}–{hhmm(per.end_time)})</span>}</label>
          <select className="field" value={d.period_no ?? 1} onChange={(e) => set({ period_no: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select></div>
        <div><label className="lbl">Subject · विषय</label><input className="field" value={d.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="lbl">Teacher · शिक्षक</label>
          <select className="field" value={other ? OTHER : d.teacher_id ?? ""} onChange={(e) => {
            if (e.target.value === OTHER) { setOther(true); set({ teacher_id: null, teacher_name: "" }); }
            else { setOther(false); const t = teachers.find((x) => x.teacher_id === e.target.value); set({ teacher_id: e.target.value || null, teacher_name: t?.teacher_name ?? "" }); }
          }}>
            <option value="">— Select —</option>
            {teachers.map((t) => <option key={t.teacher_id} value={t.teacher_id}>{t.teacher_name}</option>)}
            <option value={OTHER}>Other (type the name)…</option>
          </select>
          {other && <input className="field mt-2" placeholder="Teacher's name" value={d.teacher_name ?? ""} onChange={(e) => set({ teacher_name: e.target.value })} />}
        </div>
        <div className="sm:col-span-2"><label className="lbl">Class held? · कक्षा भयो?</label>
          <div className="flex gap-2">
            <button type="button" className={d.held ? "btn" : "btn-soft"} onClick={() => set({ held: true })}>Held · भयो</button>
            <button type="button" className={d.held === false ? "btn" : "btn-soft"} onClick={() => set({ held: false })}>Not held · भएन</button>
          </div></div>
      </div>

      {d.held ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="lbl">Arrival · आएको समय</label><input className="field" type="time" value={hhmm(d.arrival_time)} onChange={(e) => set({ arrival_time: e.target.value })} /></div>
          <div><label className="lbl">Departure · गएको समय</label><input className="field" type="time" value={hhmm(d.departure_time)} onChange={(e) => set({ departure_time: e.target.value })} /></div>
          <div><label className="lbl">Present students · उपस्थित</label><input className="field" type="number" min={0} value={d.present_count ?? ""} onChange={(e) => set({ present_count: e.target.value === "" ? null : Number(e.target.value) })} /></div>
          <div><label className="lbl">Total students · जम्मा</label><input className="field" type="number" min={0} value={d.total_count ?? ""} onChange={(e) => set({ total_count: e.target.value === "" ? null : Number(e.target.value) })} /></div>
        </div>
      ) : (
        <div><label className="lbl">Reason the class was not held · कारण</label><textarea className="field min-h-20" value={d.not_held_reason ?? ""} onChange={(e) => set({ not_held_reason: e.target.value })} /></div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="lbl">Teaching-learning issues · शिक्षण सिकाइका समस्या</label><textarea className="field min-h-20" value={d.issues ?? ""} onChange={(e) => set({ issues: e.target.value })} /></div>
        <div><label className="lbl">Facility problems · सुविधाका समस्या</label><textarea className="field min-h-20" value={d.facilities ?? ""} onChange={(e) => set({ facilities: e.target.value })} /></div>
        <div><label className="lbl">Requests · अनुरोध</label><textarea className="field min-h-20" value={d.requests ?? ""} onChange={(e) => set({ requests: e.target.value })} /></div>
        <div><label className="lbl">Suggestions · सुझाव</label><textarea className="field min-h-20" value={d.suggestions ?? ""} onChange={(e) => set({ suggestions: e.target.value })} /></div>
      </div>
      {err && <p className="rounded-md border border-destructive p-2 text-sm text-destructive">{err}</p>}
      <div className="flex gap-2"><button className="btn" disabled={busy} onClick={submit}>{busy ? "Saving…" : initial ? "Save changes" : "Submit report"}</button>{onCancel && <button className="btn-soft" onClick={onCancel}>Cancel</button>}</div>
    </div>
  );
}
