import { useEffect, useMemo, useState } from "react";
import { yearProgress, loadDeptProgress, classStatus, STATUS_META, type ProgressRow, type ClassStatus } from "@/lib/progress-sync";

const ORDER: ClassStatus[] = ["behind", "slow", "inactive", "not_started", "on_time"];

export function FacultyProgressMatrix({ dept, yearName }: { dept: string; yearName: string }) {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<ClassStatus | "all">("all");

  const prog = yearProgress(yearName);
  const now = new Date();

  useEffect(() => {
    if (!dept || !yearName) return;
    setLoading(true);
    loadDeptProgress(dept, yearName)
      .then((r) => {
        setRows(r);
        setErr("");
      })
      .catch((e: any) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [dept, yearName]);

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const expected = prog?.expectedPct ?? 0;
        const actual = r.lh_total > 0 ? Math.min(100, Math.round((r.lh_done / r.lh_total) * 100)) : 0;
        return { r, actual, status: classStatus(r, expected, now) };
      }),
    [rows, prog?.expectedPct]
  );

  const sorted = [...enriched].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const shown = filter === "all" ? sorted : sorted.filter((x) => x.status === filter);

  const totals = {
    lhDone: rows.reduce((s, r) => s + r.lh_done, 0),
    lhTotal: rows.reduce((s, r) => s + r.lh_total, 0),
    plansTotal: rows.reduce((s, r) => s + r.plans_total, 0),
    plansApproved: rows.reduce((s, r) => s + r.plans_approved, 0),
    students: rows.reduce((s, r) => s + r.students_count, 0),
  };
  const avgActual = totals.lhTotal > 0 ? Math.round((totals.lhDone / totals.lhTotal) * 100) : 0;

  if (!dept) return <p className="panel mb-4 text-xs text-muted-foreground">विभाग छान्नुहोस्।</p>;
  if (!prog) return <p className="panel mb-4 text-xs text-destructive">शैक्षिक वर्षको नाम (जस्तै 2083/84) मिलेन।</p>;

  return (
    <section className="panel mb-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Faculty Progress Matrix · शिक्षक प्रगति तालिका</h2>
          <p className="text-xs text-muted-foreground">
            श्रावण १ देखि · अपेक्षित प्रगति: <b>{prog.expectedPct}%</b> (वर्षको {prog.elapsed}/{prog.total} दिन)
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-soft no-print text-xs">
          🖨️ Print
        </button>
      </div>

      <div className="no-print mb-3 flex flex-wrap gap-1.5">
        {(["all", ...ORDER] as const).map((s) => {
          const count = s === "all" ? enriched.length : enriched.filter((x) => x.status === s).length;
          const label = s === "all" ? { en: "All", ne: "सबै", cls: "" } : STATUS_META[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                filter === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              }`}
            >
              {label.en} · {label.ne} ({count})
            </button>
          );
        })}
      </div>

      {err && <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</p>}
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50 uppercase text-muted-foreground">
              <th className="p-2.5">Class / Subject<br /><span className="normal-case">कक्षा / विषय</span></th>
              <th className="p-2.5">Teacher<br /><span className="normal-case">शिक्षक</span></th>
              <th className="p-2.5 text-center">Students<br /><span className="normal-case">विद्यार्थी</span></th>
              <th className="p-2.5 text-center">LH<br /><span className="normal-case">सम्पन्न / कुल</span></th>
              <th className="p-2.5 w-44">Course progress<br /><span className="normal-case">प्रगति</span></th>
              <th className="p-2.5 text-center">Plans<br /><span className="normal-case">स्वीकृत / कुल</span></th>
              <th className="p-2.5">Last diary<br /><span className="normal-case">अन्तिम डायरी</span></th>
              <th className="p-2.5 text-center">Status<br /><span className="normal-case">स्थिति</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map(({ r, actual, status }) => {
              const m = STATUS_META[status];
              return (
                <tr key={`${r.teacher_user_id}-${r.local_class_id}`} className="hover:bg-muted/20">
                  <td className="p-2.5">
                    <div className="font-bold text-foreground">{r.class_name}</div>
                    <div className="text-muted-foreground">{r.subject}</div>
                  </td>
                  <td className="p-2.5 font-medium">{r.teacher_name}</td>
                  <td className="p-2.5 text-center">{r.students_count}</td>
                  <td className="p-2.5 text-center">
                    <b>{r.lh_done}</b> / {r.lh_total}
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${actual}%` }} />
                        <div
                          className="absolute top-0 h-full w-0.5 bg-foreground/70"
                          style={{ left: `${prog.expectedPct}%` }}
                          title={`अपेक्षित ${prog.expectedPct}%`}
                        />
                      </div>
                      <span className="w-10 text-right font-bold text-primary">{actual}%</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-center">
                    {r.plans_approved} / {r.plans_total}
                  </td>
                  <td className="p-2.5">{r.last_diary ?? "—"}</td>
                  <td className="p-2.5 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.cls}`}>
                      {m.en} · {m.ne}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!shown.length && !loading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  यस विभागमा यस वर्षको कुनै कक्षा रेकर्ड छैन। · No records.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-bold">
                <td className="p-2.5">Total · जम्मा ({rows.length} classes)</td>
                <td className="p-2.5">—</td>
                <td className="p-2.5 text-center">{totals.students}</td>
                <td className="p-2.5 text-center">
                  {totals.lhDone} / {totals.lhTotal}
                </td>
                <td className="p-2.5">Average: {avgActual}%</td>
                <td className="p-2.5 text-center">
                  {totals.plansApproved} / {totals.plansTotal}
                </td>
                <td className="p-2.5">—</td>
                <td className="p-2.5 text-center">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        तालिकामा सेतो रेखा = अपेक्षित प्रगति। निलो भाग = वास्तविक प्रगति। पहिले पछाडि परेका कक्षा माथि देखिन्छन्।
      </p>
    </section>
  );
}
