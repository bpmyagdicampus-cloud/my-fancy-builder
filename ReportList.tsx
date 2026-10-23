import { useMemo, useState } from "react";
import { PrintBtn } from "@/components/app/ui";
import { PeriodPicker, defaultSpan, spanRange, type Span } from "@/components/sqc/PeriodPicker";
import { fmtBs, todayBs } from "@/lib/bs";
import { addAction, deleteReport } from "@/lib/sqc-data";
import { STATUSES, STATUS_NE, className, durationMinutes, filterReports, fmtMin, hhmm, lateMinutes, type Action, type Filters, type Period, type Report, type SqcClass, type Status } from "@/lib/sqc";
import { BsDate } from "@/components/app/ui";

const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s);
const Chip = ({ s }: { s: Status }) => <span className={s === "Resolved" ? "chip-on" : "chip"}>{STATUS_NE[s]} · {s}</span>;

export function ReportList({ rows, classes, periods, actions, admin, canEdit, onEdit, onChanged }: {
  rows: Report[]; classes: SqcClass[]; periods: Period[]; actions: Action[]; admin: boolean; canEdit: boolean;
  onEdit: (r: Report) => void; onChanged: () => void;
}) {
  const [span, setSpan] = useState<Span>(() => ({ ...defaultSpan(todayBs()), mode: "all" }));
  const [f, setF] = useState<Filters>({});
  const [sel, setSel] = useState<string | null>(null);
  const range = spanRange(span);
  const filters: Filters = { ...f, from: range.from, to: range.to };
  const list = useMemo(() => filterReports(rows, filters, classes), [rows, f, span, classes]); // eslint-disable-line react-hooks/exhaustive-deps
  const teacherNames = useMemo(() => [...new Map(rows.map((r) => [r.teacher_id ?? `n:${r.teacher_name}`, r.teacher_name])).entries()], [rows]);
  const chosen = rows.find((r) => r.id === sel) ?? null;
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));

  return (
    <div>
      <div className="no-print panel mb-3 space-y-3">
        <PeriodPicker value={span} onChange={setSpan} />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div><label className="lbl">Class</label><select className="field" value={f.classId ?? ""} onChange={(e) => set({ classId: e.target.value })}><option value="">All</option>{classes.map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}</select></div>
          <div><label className="lbl">Teacher</label><select className="field" value={f.teacherId ?? ""} onChange={(e) => set({ teacherId: e.target.value })}><option value="">All</option>{teacherNames.filter(([k]) => !k.startsWith("n:")).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
          <div><label className="lbl">Period</label><select className="field" value={f.period ?? ""} onChange={(e) => set({ period: e.target.value ? Number(e.target.value) : undefined })}><option value="">All</option>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div><label className="lbl">Status</label><select className="field" value={f.status ?? ""} onChange={(e) => set({ status: e.target.value })}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="lbl">Class held?</label><select className="field" value={f.held ?? ""} onChange={(e) => set({ held: e.target.value as Filters["held"] })}><option value="">All</option><option value="yes">Held</option><option value="no">Not held</option></select></div>
          <div><label className="lbl">Search</label><input className="field" placeholder="teacher, issue, subject…" value={f.q ?? ""} onChange={(e) => set({ q: e.target.value })} /></div>
        </div>
        <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{list.length} of {rows.length} reports</span><button className="btn-soft" onClick={() => setF({})}>Clear filters</button><span className="flex-1" /><PrintBtn /></div>
      </div>

      <div className="print-only mb-3 text-center"><div className="text-xl font-bold">Student Quality Control (SQC) — Reports</div><div className="text-sm">{range.label}{f.status ? ` · ${f.status}` : ""}</div></div>

      {/* wide screens and print: table */}
      <div className="hidden overflow-x-auto md:block print:block">
        <table className="rtable">
          <thead><tr><th>Date</th><th>P</th><th>Class</th><th>Teacher · subject</th><th>Held</th><th>Arrive–leave</th><th>Late</th><th>Issues / requests</th><th>Status</th><th className="no-print"></th></tr></thead>
          <tbody>
            {list.map((r) => {
              const late = lateMinutes(r, periods);
              return (
                <tr key={r.id} className={sel === r.id ? "bg-accent/40" : ""}>
                  <td>{fmtBs(r.report_date)}</td><td>{r.period_no}</td><td>{className(classes.find((c) => c.id === r.class_id))}</td>
                  <td>{r.teacher_name || "—"}<div className="text-[11px] text-muted-foreground">{r.subject}</div></td>
                  <td>{r.held ? "Yes" : `No — ${short(r.not_held_reason, 40)}`}</td>
                  <td>{r.held ? `${hhmm(r.arrival_time)}–${hhmm(r.departure_time) || "?"}` : "—"}</td>
                  <td>{late === null ? "—" : late > 0 ? fmtMin(late) : "on time"}</td>
                  <td>{short([r.issues, r.facilities, r.requests, r.suggestions].filter(Boolean).join(" | "), 80) || "—"}</td>
                  <td><Chip s={r.status} /></td>
                  <td className="no-print"><button className="btn-soft" onClick={() => setSel(sel === r.id ? null : r.id)}>{sel === r.id ? "Close" : "Open"}</button></td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={10} className="text-muted-foreground">No reports match.</td></tr>}
          </tbody>
        </table>
      </div>
      {/* phones: cards */}
      <div className="space-y-2 md:hidden print:hidden">
        {list.map((r) => (
          <button key={r.id} onClick={() => setSel(sel === r.id ? null : r.id)} className="panel w-full text-left">
            <div className="flex items-center gap-2"><b>{fmtBs(r.report_date)} · P{r.period_no}</b><span className="flex-1" /><Chip s={r.status} /></div>
            <div className="text-sm">{className(classes.find((c) => c.id === r.class_id))} · {r.teacher_name || "—"}</div>
            <div className="text-xs text-muted-foreground">{r.held ? `Held ${hhmm(r.arrival_time)}–${hhmm(r.departure_time) || "?"}` : `Not held: ${short(r.not_held_reason, 50)}`}</div>
          </button>
        ))}
        {!list.length && <p className="text-sm text-muted-foreground">No reports match.</p>}
      </div>

      {chosen && <Detail r={chosen} classes={classes} periods={periods} actions={actions.filter((a) => a.report_id === chosen.id)} admin={admin} canEdit={canEdit} onEdit={onEdit} onChanged={() => { setSel(null); onChanged(); }} />}
    </div>
  );
}

function Detail({ r, classes, periods, actions, admin, canEdit, onEdit, onChanged }: {
  r: Report; classes: SqcClass[]; periods: Period[]; actions: Action[]; admin: boolean; canEdit: boolean; onEdit: (r: Report) => void; onChanged: () => void;
}) {
  const [a, setA] = useState({ response: "", responsible: "", action_taken: "", resolved_on: "" as string, status: r.status as Status });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const late = lateMinutes(r, periods), dur = durationMinutes(r);
  const row = (l: string, v: string) => v.trim() && <div><div className="lbl">{l}</div><div className="whitespace-pre-wrap text-sm">{v}</div></div>;
  const saveAction = async () => {
    if (!a.response.trim() && !a.action_taken.trim() && a.status === r.status) return setErr("Write a response or action, or change the status.");
    setBusy(true); setErr("");
    const x = await addAction({ report_id: r.id, response: a.response.trim(), responsible: a.responsible.trim(), action_taken: a.action_taken.trim(), resolved_on: a.status === "Resolved" ? (a.resolved_on || todayBs()) : null, status: a.status });
    setBusy(false);
    if (!x.ok) return setErr(x.error);
    onChanged();
  };
  return (
    <div className="panel mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold">{className(classes.find((c) => c.id === r.class_id))} · {fmtBs(r.report_date)} · Period {r.period_no}</h3><Chip s={r.status} />
        <span className="flex-1" />
        {canEdit && r.status === "Submitted" && <button className="btn-soft" onClick={() => onEdit(r)}>Edit</button>}
        {admin && <button className="btn-danger" onClick={async () => { if (!confirm("Delete this report permanently?")) return; const x = await deleteReport(r.id); if (!x.ok) alert(x.error); else onChanged(); }}>Delete</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div><div className="lbl">Teacher</div>{r.teacher_name || "—"}<div className="text-xs text-muted-foreground">{r.subject}</div></div>
        <div><div className="lbl">Class held</div>{r.held ? "Yes" : "No"}</div>
        <div><div className="lbl">Arrival → departure</div>{r.held ? `${hhmm(r.arrival_time)} → ${hhmm(r.departure_time) || "—"}` : "—"}{dur !== null && <span className="text-xs text-muted-foreground"> ({fmtMin(dur)})</span>}</div>
        <div><div className="lbl">Late</div>{late === null ? "—" : late > 0 ? fmtMin(late) : "on time"}</div>
        <div><div className="lbl">Present / total</div>{r.present_count ?? "—"} / {r.total_count ?? "—"}</div>
        <div><div className="lbl">Submitted</div>{r.submitted_by_name || "—"}<div className="text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</div></div>
        <div><div className="lbl">Academic year</div>{r.year_name || "—"}</div>
      </div>
      {row("Reason class was not held", r.not_held_reason)}{row("Teaching-learning issues", r.issues)}{row("Facility problems", r.facilities)}{row("Requests", r.requests)}{row("Suggestions", r.suggestions)}

      <div>
        <h4 className="mb-1 font-semibold">Administrator response & action history</h4>
        {actions.length === 0 && <p className="text-sm text-muted-foreground">No response yet.</p>}
        <ul className="space-y-2">
          {actions.map((x) => (
            <li key={x.id} className="rounded-md border border-border p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2"><Chip s={x.status} /><span className="text-xs text-muted-foreground">{new Date(x.created_at).toLocaleString()}</span>{x.resolved_on && <span className="text-xs">Resolved on {fmtBs(x.resolved_on)}</span>}</div>
              {x.response && <div className="mt-1 whitespace-pre-wrap">{x.response}</div>}
              {(x.responsible || x.action_taken) && <div className="mt-1 text-xs text-muted-foreground">{x.responsible && <>Responsible: <b>{x.responsible}</b>. </>}{x.action_taken && <>Action taken: {x.action_taken}</>}</div>}
            </li>
          ))}
        </ul>
      </div>

      {admin && (
        <div className="no-print rounded-md border border-primary p-3">
          <h4 className="mb-2 font-semibold">Respond / update status</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="lbl">Response</label><textarea className="field min-h-16" value={a.response} onChange={(e) => setA({ ...a, response: e.target.value })} /></div>
            <div><label className="lbl">Responsible person</label><input className="field" value={a.responsible} onChange={(e) => setA({ ...a, responsible: e.target.value })} /></div>
            <div><label className="lbl">Status</label><select className="field" value={a.status} onChange={(e) => setA({ ...a, status: e.target.value as Status })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="lbl">Action taken</label><textarea className="field min-h-16" value={a.action_taken} onChange={(e) => setA({ ...a, action_taken: e.target.value })} /></div>
            {a.status === "Resolved" && <div><label className="lbl">Resolution date</label><BsDate value={a.resolved_on} onChange={(v) => setA({ ...a, resolved_on: v })} /></div>}
          </div>
          {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
          <button className="btn mt-2" disabled={busy} onClick={saveAction}>{busy ? "Saving…" : "Save response"}</button>
        </div>
      )}
    </div>
  );
}
