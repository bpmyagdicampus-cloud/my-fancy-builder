import { useCallback, useEffect, useState } from "react";
import { BsDate, BsMonth, PrintBtn, PrintHead, Signatures } from "@/components/app/ui";
import { BS_MONTHS, fmtBs, inRange, todayBs } from "@/lib/bs";
import * as D from "@/lib/dm";
import { useTeacher } from "@/lib/store";

const money = (n: number) => `रु. ${Number(n || 0).toLocaleString("en-IN")}`;
const actStatus = (k: string) => D.ACT_STATUS.find((s) => s.k === k)?.ne ?? k;
const planStatus = (k: string) => D.PLAN_STATUS.find((s) => s.k === k)?.ne ?? k;
const catLabel = (k: string) => D.ACT_CATEGORIES.find((c) => c.k === k)?.ne ?? k;

export function ReportsTab({
  dept,
  deptName,
  year,
  canManage,
}: {
  dept: string;
  deptName: string;
  year: string;
  canManage: boolean;
}) {
  const { profile } = useTeacher();
  const [mode, setMode] = useState<"annual" | "monthly" | "range">("annual");
  const [month, setMonth] = useState(todayBs().slice(0, 7));
  const [fromDate, setFromDate] = useState(`${year.slice(0, 4) || "2083"}-01-01`);
  const [toDate, setToDate] = useState(todayBs());

  const [showPlans, setShowPlans] = useState(true);
  const [showActs, setShowActs] = useState(true);
  const [showBudget, setShowBudget] = useState(true);

  const [plans, setPlans] = useState<D.DmPlan[]>([]);
  const [acts, setActs] = useState<D.DmActivity[]>([]);
  const [lines, setLines] = useState<D.DmBudgetLine[]>([]);
  const [expenses, setExpenses] = useState<D.DmExpense[]>([]);
  const [evidence, setEvidence] = useState<D.DmEvidence[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!dept || !year) return;
    const [pRes, aRes, evRes] = await Promise.all([
      D.loadPlans(dept, year),
      D.loadActivities(dept, year),
      D.loadEvidence(dept),
    ]);
    if (!pRes.ok) {
      setErr(pRes.error);
      return;
    }
    setErr("");
    setPlans(pRes.data);
    if (aRes.ok) setActs(aRes.data);
    if (evRes.ok) setEvidence(evRes.data);

    if (canManage) {
      const [lRes, eRes] = await Promise.all([D.loadBudgetLines(dept), D.loadExpenses(dept)]);
      if (lRes.ok) setLines(lRes.data);
      if (eRes.ok) setExpenses(eRes.data);
    } else {
      setLines([]);
      setExpenses([]);
    }
  }, [dept, year, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  // Date filter helper
  const matchDate = (d: string) => {
    if (mode === "annual") return true;
    if (!d) return false;
    if (mode === "monthly") return d.startsWith(month);
    return inRange(d, fromDate, toDate);
  };

  const filteredPlans = plans.filter((p) => {
    if (mode === "annual") return true;
    if (!p.start_date && !p.end_date) return true;
    if (mode === "monthly") {
      return (p.start_date && p.start_date.startsWith(month)) || (p.end_date && p.end_date.startsWith(month));
    }
    return (p.start_date && inRange(p.start_date, fromDate, toDate)) || (p.end_date && inRange(p.end_date, fromDate, toDate));
  });

  const filteredActs = acts.filter((a) => (mode === "annual" ? true : matchDate(a.activity_date || a.deadline)));

  const planIds = new Set(plans.map((p) => p.id));
  const actIds = new Set(acts.map((a) => a.id));
  const yearLines = lines.filter(
    (l) => (!l.plan_id && !l.activity_id) || (l.plan_id && planIds.has(l.plan_id)) || (l.activity_id && actIds.has(l.activity_id))
  );
  const yearLineIds = new Set(yearLines.map((l) => l.id));
  const yearPrefix = year.slice(0, 4);
  const filteredExpenses = expenses.filter((e) => {
    const inYear =
      (e.line_id && yearLineIds.has(e.line_id)) ||
      (e.plan_id && planIds.has(e.plan_id)) ||
      (e.activity_id && actIds.has(e.activity_id)) ||
      (!e.line_id && !e.plan_id && !e.activity_id && (!yearPrefix || (e.expense_date || "").startsWith(yearPrefix)));
    if (!inYear) return false;
    return mode === "annual" ? true : matchDate(e.expense_date);
  });

  const [mY = 2083, mM = 1] = month.split("-").map(Number);
  const periodLabel =
    mode === "annual"
      ? `शैक्षिक वर्ष ${year} (वार्षिक प्रतिवेदन)`
      : mode === "monthly"
      ? `${BS_MONTHS[mM - 1]} ${mY} (मासिक प्रतिवेदन)`
      : `${fmtBs(fromDate)} देखि ${fmtBs(toDate)} सम्म`;

  const avgProg = filteredActs.length
    ? Math.round(filteredActs.reduce((s, a) => s + (a.progress_pct || 0), 0) / filteredActs.length)
    : 0;
  const totalProposed = yearLines.reduce((s, l) => s + Number(l.proposed || 0), 0);
  const totalApproved = yearLines
    .filter((l) => l.status === "approved")
    .reduce((s, l) => s + Number(l.approved || 0), 0);
  const totalSpent = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div>
      {err && <p className="no-print mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}

      {/* Filter & Export toolbar */}
      <section className="panel no-print mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="lbl !mb-0">Report period · प्रतिवेदन अवधि:</label>
            <select
              className="field !w-48"
              value={mode}
              onChange={(e) => setMode(e.target.value as "annual" | "monthly" | "range")}
            >
              <option value="annual">Annual · वार्षिक ({year})</option>
              <option value="monthly">Monthly · मासिक</option>
              <option value="range">Date range · मिति अनुसार</option>
            </select>
            {mode === "monthly" && <BsMonth value={month} onChange={setMonth} />}
            {mode === "range" && (
              <div className="flex flex-wrap items-center gap-2">
                <BsDate value={fromDate} onChange={setFromDate} />
                <span>→</span>
                <BsDate value={toDate} onChange={setToDate} />
              </div>
            )}
          </div>
          <PrintBtn />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-muted-foreground">Include sections · समावेश गर्ने खण्डहरू:</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showPlans} onChange={(e) => setShowPlans(e.target.checked)} />
            <span>Annual Plans · वार्षिक योजना ({filteredPlans.length})</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showActs} onChange={(e) => setShowActs(e.target.checked)} />
            <span>Activities & Progress · गतिविधि तथा प्रगति ({filteredActs.length})</span>
          </label>
          {canManage && (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={showBudget} onChange={(e) => setShowBudget(e.target.checked)} />
              <span>Budget & Expenses · बजेट तथा खर्च ({filteredExpenses.length})</span>
            </label>
          )}
        </div>
      </section>

      {/* Printable Report Surface */}
      <section className="panel overflow-x-auto">
        <PrintHead
          title={
            <>
              <div>विभागीय प्रगति तथा अनुगमन प्रतिवेदन · Departmental Progress Report</div>
              <div className="text-sm font-normal">
                विभाग: <b>{deptName || "—"}</b> · {periodLabel}
              </div>
            </>
          }
        />

        {/* 1. Executive Summary Table */}
        <h3 className="mb-1 mt-3 text-sm font-bold">१. सारांश विवरण (Executive Summary)</h3>
        <table className="rtable mb-5">
          <thead>
            <tr>
              <th>सूचक (Indicator)</th>
              <th>विवरण (Details)</th>
              <th>संख्या / अवस्था (Count / Value)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>वार्षिक योजनाहरू (Annual Plans)</td>
              <td>
                स्वीकृत: {filteredPlans.filter((p) => p.status === "approved").length}, पेस गरिएको:{" "}
                {filteredPlans.filter((p) => p.status === "submitted").length}, मस्यौदा:{" "}
                {filteredPlans.filter((p) => p.status === "draft").length}
              </td>
              <td>{filteredPlans.length}</td>
            </tr>
            <tr>
              <td>सञ्चालित गतिविधिहरू (Activities)</td>
              <td>
                सम्पन्न: {filteredActs.filter((a) => a.status === "completed").length}, चलिरहेको:{" "}
                {filteredActs.filter((a) => a.status === "in_progress").length}, योजनामा:{" "}
                {filteredActs.filter((a) => a.status === "planned").length}, ढिलो:{" "}
                {filteredActs.filter((a) => a.status === "delayed").length}
              </td>
              <td>{filteredActs.length} (औसत प्रगति: {avgProg}%)</td>
            </tr>
            {canManage && (
              <tr>
                <td>बजेट तथा खर्च अवस्था (Budget Summary)</td>
                <td>
                  प्रस्तावित: {money(totalProposed)} · स्वीकृत: {money(totalApproved)} · खर्च: {money(totalSpent)}
                </td>
                <td>बाँकी: {money(totalApproved - totalSpent)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 2. Annual Plans Table */}
        {showPlans && (
          <>
            <h3 className="mb-1 mt-4 text-sm font-bold">२. वार्षिक योजना विवरण (Annual Plans)</h3>
            <table className="rtable mb-5">
              <thead>
                <tr>
                  <th>क्र.सं.</th>
                  <th>योजना / कार्यक्रम (Title)</th>
                  <th>उद्देश्य र लक्ष्य (Objectives & Targets)</th>
                  <th>अवधि (Timeline)</th>
                  <th>अनुमानित बजेट</th>
                  <th>स्रोत</th>
                  <th>स्थिति</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>
                      <b>{p.title}</b>
                    </td>
                    <td>
                      {p.objectives && <div>उद्देश्य: {p.objectives}</div>}
                      {p.targets && <div>लक्ष्य: {p.targets}</div>}
                      {p.expected_outcomes && <div>उपलब्धि: {p.expected_outcomes}</div>}
                    </td>
                    <td>
                      {p.start_date ? fmtBs(p.start_date) : "—"} देखि {p.end_date ? fmtBs(p.end_date) : "—"}
                    </td>
                    <td>{money(p.estimated_budget)}</td>
                    <td>{p.funding_source || "—"}</td>
                    <td>{planStatus(p.status)}</td>
                  </tr>
                ))}
                {!filteredPlans.length && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground">
                      यस अवधिमा कुनै वार्षिक योजना फेला परेन।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* 3. Activities & Progress Table */}
        {showActs && (
          <>
            <h3 className="mb-1 mt-4 text-sm font-bold">३. गतिविधि तथा प्रगति विवरण (Activities & Progress)</h3>
            <table className="rtable mb-5">
              <thead>
                <tr>
                  <th>क्र.सं.</th>
                  <th>मिति / समयसीमा</th>
                  <th>गतिविधि र प्रकार</th>
                  <th>जिम्मेवार व्यक्ति / सहभागी</th>
                  <th>अपेक्षित र वास्तविक उपलब्धि</th>
                  <th>प्रगति %</th>
                  <th>स्थिति</th>
                  <th>चुनौती र आगामी कदम</th>
                </tr>
              </thead>
              <tbody>
                {filteredActs.map((a, i) => {
                  const evCount = evidence.filter((ev) => ev.activity_id === a.id).length;
                  return (
                    <tr key={a.id}>
                      <td>{i + 1}</td>
                      <td>
                        {a.activity_date ? fmtBs(a.activity_date) : "—"}
                        {a.deadline && <div className="text-xs">सीमा: {fmtBs(a.deadline)}</div>}
                      </td>
                      <td>
                        <b>{a.title}</b>
                        <div className="text-xs">({catLabel(a.category)})</div>
                      </td>
                      <td>
                        <div>{a.responsible_name || "—"}</div>
                        {a.participants && <div className="text-xs">सहभागी: {a.participants}</div>}
                      </td>
                      <td>
                        {a.planned_output && <div>योजना: {a.planned_output}</div>}
                        {a.actual_output && <div>उपलब्धि: {a.actual_output}</div>}
                        {evCount > 0 && <div className="text-xs">प्रमाण फाइल: {evCount}</div>}
                      </td>
                      <td>{a.progress_pct}%</td>
                      <td>{actStatus(a.status)}</td>
                      <td>
                        {a.challenges && <div>चुनौती: {a.challenges}</div>}
                        {a.corrective_actions && <div>सुधार: {a.corrective_actions}</div>}
                        {a.next_steps && <div>आगामी: {a.next_steps}</div>}
                      </td>
                    </tr>
                  );
                })}
                {!filteredActs.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground">
                      यस अवधिमा कुनै गतिविधि फेला परेन।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* 4. Budget & Expenses Tables (HOD / Admin only) */}
        {canManage && showBudget && (
          <>
            <h3 className="mb-1 mt-4 text-sm font-bold">४. बजेट शीर्षक तथा खर्च अवस्था (Budget Lines & Balance)</h3>
            <table className="rtable mb-5">
              <thead>
                <tr>
                  <th>क्र.सं.</th>
                  <th>बजेट शीर्षक (Budget Heading)</th>
                  <th>स्थिति</th>
                  <th>प्रस्तावित रकम</th>
                  <th>स्वीकृत रकम</th>
                  <th>खर्च रकम</th>
                  <th>बाँकी रकम</th>
                </tr>
              </thead>
              <tbody>
                {yearLines.map((l, i) => {
                  const sp = filteredExpenses
                    .filter((e) => e.line_id === l.id)
                    .reduce((s, e) => s + Number(e.amount || 0), 0);
                  const base = l.status === "approved" ? l.approved : l.proposed;
                  return (
                    <tr key={l.id}>
                      <td>{i + 1}</td>
                      <td>{l.title}</td>
                      <td>{planStatus(l.status)}</td>
                      <td>{money(l.proposed)}</td>
                      <td>{money(l.approved)}</td>
                      <td>{money(sp)}</td>
                      <td>{money(base - sp)}</td>
                    </tr>
                  );
                })}
                {!yearLines.length && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground">
                      कुनै बजेट शीर्षक प्रविष्ट गरिएको छैन।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <h3 className="mb-1 mt-4 text-sm font-bold">५. खर्च तथा भौचर विवरण (Itemized Expenditure Statement)</h3>
            <table className="rtable mb-5">
              <thead>
                <tr>
                  <th>क्र.सं.</th>
                  <th>मिति (BS)</th>
                  <th>भौचर नं.</th>
                  <th>खर्चको विवरण</th>
                  <th>बजेट शीर्षक</th>
                  <th>रकम (रु.)</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e, i) => (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td>{e.expense_date ? fmtBs(e.expense_date) : "—"}</td>
                    <td>{e.voucher_no || "—"}</td>
                    <td>{e.description}</td>
                    <td>{lines.find((l) => l.id === e.line_id)?.title ?? "—"}</td>
                    <td>{money(e.amount)}</td>
                  </tr>
                ))}
                {filteredExpenses.length > 0 && (
                  <tr>
                    <td colSpan={5} className="text-right font-bold">
                      जम्मा खर्च (Total Expenditure)
                    </td>
                    <td className="font-bold">{money(totalSpent)}</td>
                  </tr>
                )}
                {!filteredExpenses.length && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground">
                      यस अवधिमा कुनै खर्च रेकर्ड भएको छैन।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        <Signatures
          roles={[
            ["Prepared by · तयार गर्ने", profile?.name],
            ["Department Head · विभागीय प्रमुख", profile?.hod],
            ["Campus Chief · क्याम्पस प्रमुख", profile?.chief],
          ]}
        />
      </section>
    </div>
  );
}
