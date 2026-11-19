import { useState } from "react";
import { BsDate } from "@/components/app/ui";
import { todayBs } from "@/lib/bs";
import { saveReport, type ClassTeaching, type Teacher } from "@/lib/sqc-data";
import { className, combinedIssues, hhmm, validateReport, type Period, type Report, type ReportDraft, type SqcClass } from "@/lib/sqc";
import { Checkbox } from "@/components/ui/checkbox";
import { confirmEditedSave, useEditScroll } from "@/components/app/editing";

const OTHER = "__other";

export function ReportForm({ classes, teachers, periods, teaching = [], initial, onSaved, onCancel }: {
  classes: SqcClass[]; teachers: Teacher[]; periods: Period[]; teaching?: ClassTeaching[]; initial?: Report; onSaved: (r: Report) => void; onCancel?: () => void;
}) {
  const [d, setD] = useState<ReportDraft & { id?: string }>(() => initial ?? { class_id: classes.length === 1 ? classes[0]?.id ?? "" : "", report_date: todayBs(), period_no: 1, held: true, teacher_id: null, teacher_name: "", subject: "", submit_for_request: false });
  const [other, setOther] = useState(!!initial && !initial.teacher_id && !!initial.teacher_name);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const editRef = useEditScroll(initial?.id);
  // subjects (and their teachers) of the chosen class, taken from the Setup classes the teachers linked
  const opts = teaching.filter((t) => t.class_id === d.class_id);
  const subjects = [...new Set(opts.map((t) => t.subject))];
  const [subOther, setSubOther] = useState(!!initial?.subject && !teaching.some((t) => t.class_id === initial.class_id && t.subject === initial.subject));
  const teacherList = (() => { const who = teachers.filter((t) => opts.some((o) => o.teacher_id === t.teacher_id)); return who.length ? who : teachers; })();
  const set = (p: Partial<ReportDraft>) => setD((x) => ({ ...x, ...p }));
  const per = periods.find((p) => p.period_no === Number(d.period_no));

  const submit = async () => {
    const v = validateReport(d);
    if (v) return setErr(v);
    if (!confirmEditedSave(initial?.id)) return;
    setBusy(true); setErr("");
    const r = await saveReport(d);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    if (!r.data) return setErr("Saved, but the record could not be read back. Please refresh.");
    onSaved(r.data);
  };

  return (
    <div ref={editRef} className="panel scroll-mt-24 space-y-3">
      <h2 className="text-lg font-bold">{initial ? "Edit report" : "New report"}</h2>
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
        <div><label className="lbl">Subject · विषय</label>
          {subjects.length ? (
            <>
              <select className="field" value={subOther ? OTHER : d.subject ?? ""} onChange={(e) => {
                const v = e.target.value;
                if (v === OTHER) { setSubOther(true); set({ subject: "" }); return; }
                setSubOther(false);
                const who = opts.filter((t) => t.subject === v);
                const selected = who[0];
                if (v && who.length === 1 && selected) { setOther(false); set({ subject: v, teacher_id: selected.teacher_id, teacher_name: selected.teacher_name }); } else set({ subject: v });
              }}>
                <option value="">— Select —</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value={OTHER}>Other (type the subject)…</option>
              </select>
              {subOther && <input className="field mt-2" placeholder="Subject" value={d.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} />}
            </>
          ) : <input className="field" value={d.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} />}
        </div>
        <div className="sm:col-span-2"><label className="lbl">Teacher · शिक्षक</label>
          <select className="field" value={other ? OTHER : d.teacher_id ?? ""} onChange={(e) => {
            if (e.target.value === OTHER) { setOther(true); set({ teacher_id: null, teacher_name: "" }); }
            else { setOther(false); const t = teachers.find((x) => x.teacher_id === e.target.value); set({ teacher_id: e.target.value || null, teacher_name: t?.teacher_name ?? "" }); }
          }}>
            <option value="">— Select —</option>
            {teacherList.map((t) => <option key={t.teacher_id} value={t.teacher_id}>{t.teacher_name}</option>)}
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
        <div className="sm:col-span-2"><label className="lbl" htmlFor="sqc-issues">Teaching-learning & facility issues</label><textarea id="sqc-issues" className="field min-h-20" value={combinedIssues(d)} onChange={(e) => set({ issues: e.target.value, facilities: "" })} /></div>
        <div><div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><label className="lbl !mb-0" htmlFor="sqc-requests">Requests</label><label className="flex items-center gap-2 text-xs font-medium"><Checkbox checked={d.submit_for_request === true} onCheckedChange={(v) => set({ submit_for_request: v === true })} />Submit for request</label></div><textarea id="sqc-requests" className="field min-h-20" value={d.requests ?? ""} onChange={(e) => set({ requests: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">टिक लगाएपछि मात्र सम्बन्धित शिक्षक वा प्रशासनको गृहपानामा अनुरोध सूचना देखिन्छ।</p></div>
        <div><label className="lbl">Suggestions · सुझाव</label><textarea className="field min-h-20" value={d.suggestions ?? ""} onChange={(e) => set({ suggestions: e.target.value })} /></div>
      </div>
      {err && <p className="rounded-md border border-destructive p-2 text-sm text-destructive">{err}</p>}
      <div className="flex gap-2"><button className="btn" disabled={busy} onClick={submit}>{busy ? "Saving…" : initial ? "Save changes" : "Submit report"}</button>{onCancel && <button className="btn-soft" onClick={onCancel}>Cancel</button>}</div>
    </div>
  );
}
