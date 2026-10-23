import { useMemo, useState } from "react";
import { PrintBtn } from "@/components/app/ui";
import { PeriodPicker, defaultSpan, spanRange, type Span } from "@/components/sqc/PeriodPicker";
import { todayBs } from "@/lib/bs";
import { STATUSES, STATUS_NE, className, filterReports, fmtMin, summarize, type Period, type Report, type Row, type SqcClass } from "@/lib/sqc";

const Stat = ({ l, v }: { l: string; v: string | number }) => <div className="panel text-center"><div className="text-2xl font-bold text-primary">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>;

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="mb-5 overflow-x-auto">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <table className="rtable">
        <thead><tr><th>Name</th><th>Reports</th><th>Held</th><th>Not held</th><th>Late</th><th>Avg late</th><th>Time in class</th><th>With issues/requests</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.key}><td>{r.name}</td><td>{r.reports}</td><td>{r.held}</td><td>{r.notHeld}</td><td>{r.late}</td><td>{r.late ? fmtMin(r.lateMin / r.late) : "—"}</td><td>{r.durationMin ? fmtMin(r.durationMin) : "—"}</td><td>{r.withIssues}</td></tr>)}
          {!rows.length && <tr><td colSpan={8} className="text-muted-foreground">No data.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

export function Summary({ rows, periods, classes }: { rows: Report[]; periods: Period[]; classes: SqcClass[] }) {
  const [span, setSpan] = useState<Span>(() => defaultSpan(todayBs()));
  const [classId, setClassId] = useState("");
  const range = spanRange(span);
  const data = useMemo(() => filterReports(rows, { from: range.from, to: range.to, classId }, classes), [rows, span, classId, classes]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = useMemo(() => summarize(data, periods, classes), [data, periods, classes]);
  return (
    <div>
      <div className="no-print panel mb-3 flex flex-wrap items-end gap-3">
        <PeriodPicker value={span} onChange={setSpan} />
        <div><label className="lbl">Class</label><select className="field" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">All</option>{classes.map((c) => <option key={c.id} value={c.id}>{className(c)}</option>)}</select></div>
        <span className="flex-1" /><PrintBtn />
      </div>
      <div className="mb-3 text-center"><div className="text-xl font-bold">SQC Summary</div><div className="text-sm">{range.label}{classId ? ` · ${className(classes.find((c) => c.id === classId))}` : ""}</div></div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Stat l="Reports" v={s.total} /><Stat l="Classes held" v={s.held} /><Stat l="Not held" v={s.notHeld} />
        <Stat l="Late arrivals" v={s.late} /><Stat l="Average lateness" v={s.avgLate === null ? "—" : fmtMin(s.avgLate)} /><Stat l="With issues/requests" v={s.withIssues} />
      </div>
      <section className="mb-5 overflow-x-auto">
        <h3 className="mb-1 font-semibold">Status</h3>
        <table className="rtable"><thead><tr>{STATUSES.map((x) => <th key={x}>{STATUS_NE[x]} · {x}</th>)}</tr></thead><tbody><tr>{STATUSES.map((x) => <td key={x}>{s.byStatus[x]}</td>)}</tr></tbody></table>
      </section>
      <Table title="By class" rows={s.byClass} />
      <Table title="By teacher" rows={s.byTeacher} />
    </div>
  );
}
