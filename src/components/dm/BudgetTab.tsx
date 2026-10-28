import { useCallback, useEffect, useState } from "react";
import { BsDate, Tabs } from "@/components/app/ui";
import { fmtBs, todayBs } from "@/lib/bs";
import * as D from "@/lib/dm";

const money = (n: number) => `रु. ${Number(n || 0).toLocaleString("en-IN")}`;
const lineStatus = (k: string) => D.LINE_STATUS.find((s) => s.k === k) ?? { k, en: k, ne: k };
const revStatus = (k: string) => D.REV_STATUS.find((s) => s.k === k) ?? { k, en: k, ne: k };

export function BudgetTab({
  dept,
  year,
  admin,
  canManage,
  onChanged,
}: {
  dept: string;
  year: string;
  admin: boolean;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [subTab, setSubTab] = useState<"lines" | "expenses">("lines");
  const [lines, setLines] = useState<D.DmBudgetLine[]>([]);
  const [revisions, setRevisions] = useState<D.DmBudgetRevision[]>([]);
  const [expenses, setExpenses] = useState<D.DmExpense[]>([]);
  const [plans, setPlans] = useState<D.DmPlan[]>([]);
  const [acts, setActs] = useState<D.DmActivity[]>([]);
  const [evidence, setEvidence] = useState<D.DmEvidence[]>([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  // Line form state
  const [lineEd, setLineEd] = useState<{ id?: string; f: D.BudgetLineForm } | null>(null);
  // Approval box for a submitted budget line (Admin)
  const [approvingId, setApprovingId] = useState<string>("");
  const [approveAmt, setApproveAmt] = useState<number>(0);
  const [approveComment, setApproveComment] = useState<string>("");
  // Revision request form (for approved budget line)
  const [revReq, setRevReq] = useState<{ lineId: string; title: string; currentApproved: number; amount: number; reason: string } | null>(null);
  // Expense form state
  const [expEd, setExpEd] = useState<{ id?: string; f: D.ExpenseForm } | null>(null);
  const [uploadingExpId, setUploadingExpId] = useState<string>("");

  const load = useCallback(async () => {
    if (!dept || !canManage) {
      setLines([]);
      setRevisions([]);
      setExpenses([]);
      return;
    }
    const [lRes, eRes, pRes, aRes, evRes] = await Promise.all([
      D.loadBudgetLines(dept),
      D.loadExpenses(dept),
      year ? D.loadPlans(dept, year) : Promise.resolve({ ok: true as const, data: [] as D.DmPlan[] }),
      year ? D.loadActivities(dept, year) : Promise.resolve({ ok: true as const, data: [] as D.DmActivity[] }),
      D.loadEvidence(dept),
    ]);
    if (!lRes.ok) {
      setErr(lRes.error);
      return;
    }
    setErr("");
    setLines(lRes.data);
    if (eRes.ok) setExpenses(eRes.data);
    if (pRes.ok) setPlans(pRes.data);
    if (aRes.ok) setActs(aRes.data);
    if (evRes.ok) setEvidence(evRes.data);

    if (lRes.data.length > 0) {
      const rRes = await D.loadBudgetRevisions(lRes.data.map((x) => x.id));
      if (rRes.ok) setRevisions(rRes.data);
    } else {
      setRevisions([]);
    }
  }, [dept, year, canManage]);

  useEffect(() => {
    void load();
    setLineEd(null);
    setExpEd(null);
    setRevReq(null);
    setApprovingId("");
  }, [load]);

  if (!canManage) {
    return (
      <section className="panel">
        <h2 className="mb-1 text-lg font-bold">Budget & Expenditure · बजेट तथा खर्च व्यवस्थापन</h2>
        <p className="text-sm text-muted-foreground">
          बजेट र खर्च सम्बन्धी विवरण विभागीय प्रमुख र क्याम्पस प्रशासनले मात्र हेर्न र व्यवस्थापन गर्न सक्छन्। · Budget lines and
          expenses are visible only to the Department Head and Administration.
        </p>
      </section>
    );
  }

  const runAction = async (p: Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    const r = await p;
    if (r.ok) {
      setNote(okMsg);
      await load();
      onChanged();
    } else {
      setNote(r.error ?? "Failed.");
    }
    return r.ok;
  };

  // Filter budget lines & expenses relevant to current academic year (or unlinked general department lines)
  const planIds = new Set(plans.map((p) => p.id));
  const actIds = new Set(acts.map((a) => a.id));
  const yearLines = lines.filter(
    (l) => (!l.plan_id && !l.activity_id) || (l.plan_id && planIds.has(l.plan_id)) || (l.activity_id && actIds.has(l.activity_id))
  );
  const yearLineIds = new Set(yearLines.map((l) => l.id));
  const yearPrefix = year.slice(0, 4);
  const yearExpenses = expenses.filter(
    (e) =>
      (e.line_id && yearLineIds.has(e.line_id)) ||
      (e.plan_id && planIds.has(e.plan_id)) ||
      (e.activity_id && actIds.has(e.activity_id)) ||
      (!e.line_id && !e.plan_id && !e.activity_id && (!yearPrefix || (e.expense_date || "").startsWith(yearPrefix)))
  );

  const spentByLine = (lineId: string) =>
    expenses.filter((e) => e.line_id === lineId).reduce((s, e) => s + Number(e.amount || 0), 0);

  const totalProposed = yearLines.reduce((s, l) => s + Number(l.proposed || 0), 0);
  const totalApproved = yearLines
    .filter((l) => l.status === "approved")
    .reduce((s, l) => s + Number(l.approved || 0), 0);
  const totalSpent = yearExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalRemaining = totalApproved - totalSpent;
  const utilPct = totalApproved > 0 ? Math.round((totalSpent / totalApproved) * 100) : 0;

  const saveLine = async () => {
    if (!lineEd) return;
    if (!lineEd.f.title.trim()) {
      setNote("Please enter the budget heading · बजेट शीर्षक लेख्नुहोस्।");
      return;
    }
    const ok = await runAction(
      lineEd.id ? D.updateBudgetLine(lineEd.id, lineEd.f) : D.createBudgetLine(dept, lineEd.f),
      lineEd.id ? "Budget line updated." : "Budget line created."
    );
    if (ok) setLineEd(null);
  };

  const submitRevision = async () => {
    if (!revReq) return;
    if (!revReq.reason.trim()) {
      setNote("Please provide a reason for the budget revision · संशोधनको कारण उल्लेख गर्नुहोस्।");
      return;
    }
    const ok = await runAction(
      D.requestBudgetRevision(revReq.lineId, revReq.amount, revReq.reason),
      "Budget revision request submitted · बजेट संशोधन अनुरोध पठाइयो।"
    );
    if (ok) setRevReq(null);
  };

  const saveExpense = async () => {
    if (!expEd) return;
    if (!expEd.f.description.trim()) {
      setNote("Please enter the expense description · खर्चको विवरण लेख्नुहोस्।");
      return;
    }
    if (!expEd.f.amount || Number(expEd.f.amount) === 0) {
      setNote("Expense amount cannot be zero · रकम शून्य हुन सक्दैन।");
      return;
    }
    const ok = await runAction(
      expEd.id ? D.updateExpense(expEd.id, expEd.f) : D.createExpense(dept, expEd.f),
      expEd.id ? "Expense updated." : "Expense recorded · खर्च प्रविष्ट भयो।"
    );
    if (ok) setExpEd(null);
  };

  const handleExpenseUpload = async (expenseId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingExpId(expenseId);
    const r = await D.uploadEvidence({ dept, expenseId, file });
    setUploadingExpId("");
    if (r.ok) {
      setNote(`Uploaded voucher "${file.name}".`);
      await load();
    } else setNote(r.error);
  };

  const openEvidence = async (ev: D.DmEvidence) => {
    const r = await D.getEvidenceUrl(ev.file_path);
    if (r.ok) window.open(r.data, "_blank", "noopener,noreferrer");
    else alert(r.error);
  };

  return (
    <div>
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      {err && <p className="mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}

      {/* Financial summary cards */}
      <section className="panel mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-md border border-border p-3 text-center">
            <div className="text-lg font-bold text-primary">{money(totalProposed)}</div>
            <div className="text-xs text-muted-foreground">Proposed · प्रस्तावित</div>
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <div className="text-lg font-bold text-primary">{money(totalApproved)}</div>
            <div className="text-xs text-muted-foreground">Approved · स्वीकृत</div>
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <div className="text-lg font-bold text-primary">{money(totalSpent)}</div>
            <div className="text-xs text-muted-foreground">Spent · कुल खर्च</div>
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <div className={`text-lg font-bold ${totalRemaining < 0 ? "text-destructive" : "text-primary"}`}>
              {money(totalRemaining)}
            </div>
            <div className="text-xs text-muted-foreground">Remaining · बाँकी</div>
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <div className="text-lg font-bold text-primary">{utilPct}%</div>
            <div className="text-xs text-muted-foreground">Utilization · खर्च दर</div>
          </div>
        </div>
      </section>

      <Tabs
        value={subTab}
        onChange={setSubTab}
        items={[
          ["lines", `Budget lines & revisions · बजेट शीर्षक (${yearLines.length})`],
          ["expenses", `Expenses & vouchers · खर्च अभिलेख (${yearExpenses.length})`],
        ]}
      />

      {subTab === "lines" && (
        <div>
          {!lineEd && (
            <button
              className="btn mb-3"
              onClick={() => {
                setLineEd({ f: { plan_id: null, activity_id: null, title: "", proposed: 0, comment: "" } });
                setNote("");
              }}
            >
              + New budget line · नयाँ बजेट शीर्षक
            </button>
          )}

          {lineEd && (
            <section className="panel mb-4 border-primary/40">
              <h3 className="mb-3 text-lg font-bold">
                {lineEd.id ? "Edit budget line · बजेट शीर्षक सम्पादन" : "New budget line · नयाँ बजेट शीर्षक"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="lbl">Budget heading / item · बजेट शीर्षक *</label>
                  <input
                    className="field"
                    value={lineEd.f.title}
                    onChange={(e) => setLineEd({ ...lineEd, f: { ...lineEd.f, title: e.target.value } })}
                    placeholder="उदा. कार्यशाला स्टेशनरी तथा खाजा खर्च"
                  />
                </div>
                <div>
                  <label className="lbl">Linked annual plan · सम्बन्धित वार्षिक योजना</label>
                  <select
                    className="field"
                    value={lineEd.f.plan_id ?? ""}
                    onChange={(e) => setLineEd({ ...lineEd, f: { ...lineEd.f, plan_id: e.target.value || null } })}
                  >
                    <option value="">— General / कुनै खास योजना नभएको —</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Linked activity · सम्बन्धित गतिविधि</label>
                  <select
                    className="field"
                    value={lineEd.f.activity_id ?? ""}
                    onChange={(e) => setLineEd({ ...lineEd, f: { ...lineEd.f, activity_id: e.target.value || null } })}
                  >
                    <option value="">— Optional —</option>
                    {acts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Proposed amount (रु.) · प्रस्तावित रकम *</label>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={lineEd.f.proposed}
                    onChange={(e) => setLineEd({ ...lineEd, f: { ...lineEd.f, proposed: Number(e.target.value) } })}
                  />
                </div>
                {admin && (
                  <div>
                    <label className="lbl">Approved amount (रु.) · स्वीकृत रकम (Admin only)</label>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      value={lineEd.f.approved ?? 0}
                      onChange={(e) => setLineEd({ ...lineEd, f: { ...lineEd.f, approved: Number(e.target.value) } })}
                    />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="lbl">Remarks / Justification · कैफियत वा औचित्य</label>
                  <textarea
                    className="field min-h-14"
                    value={lineEd.f.comment ?? ""}
                    onChange={(e) => setLineEd({ ...lineEd, f: { ...lineEd.f, comment: e.target.value } })}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn" onClick={() => void saveLine()}>
                  Save
                </button>
                <button className="btn-soft" onClick={() => setLineEd(null)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          {revReq && (
            <section className="panel mb-4 border-primary/40">
              <h3 className="mb-1 text-base font-bold">Request Budget Revision · बजेट संशोधन अनुरोध</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {revReq.title} (हाल स्वीकृत: {money(revReq.currentApproved)})
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="lbl">New requested amount (रु.) · संशोधित माग रकम</label>
                  <input
                    className="field"
                    type="number"
                    min={0}
                    value={revReq.amount}
                    onChange={(e) => setRevReq({ ...revReq, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="lbl">Reason for revision · संशोधन गर्नुको कारण *</label>
                  <textarea
                    className="field min-h-16"
                    value={revReq.reason}
                    onChange={(e) => setRevReq({ ...revReq, reason: e.target.value })}
                    placeholder="बजेट थप वा घट गर्नुको कारण..."
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn" onClick={() => void submitRevision()}>
                  Submit request · अनुरोध पठाउनुहोस्
                </button>
                <button className="btn-soft" onClick={() => setRevReq(null)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          <div className="space-y-3">
            {yearLines.map((l) => {
              const st = lineStatus(l.status);
              const spent = spentByLine(l.id);
              const rem = (l.status === "approved" ? l.approved : l.proposed) - spent;
              const pName = plans.find((p) => p.id === l.plan_id)?.title;
              const aName = acts.find((a) => a.id === l.activity_id)?.title;
              const lineRevs = revisions.filter((r) => r.line_id === l.id);
              const lockedForHead = l.status === "approved" && !admin;

              return (
                <section key={l.id} className="panel">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold">{l.title}</h3>
                      <div className="text-xs text-muted-foreground">
                        प्रस्तावित: <b>{money(l.proposed)}</b> · स्वीकृत: <b>{money(l.approved)}</b> · खर्च:{" "}
                        <b>{money(spent)}</b> · बाँकी:{" "}
                        <b className={rem < 0 ? "text-destructive" : ""}>{money(rem)}</b>
                      </div>
                      {(pName || aName) && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {pName && `योजना: ${pName}`} {pName && aName && " · "} {aName && `गतिविधि: ${aName}`}
                        </div>
                      )}
                      {l.comment && <div className="mt-1 text-xs italic text-muted-foreground">“{l.comment}”</div>}
                    </div>
                    <span className={l.status === "approved" ? "chip-on" : "chip"}>
                      {st.en} · {st.ne}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!lockedForHead && (
                      <button
                        className="btn-soft"
                        onClick={() => {
                          setLineEd({
                            id: l.id,
                            f: {
                              plan_id: l.plan_id,
                              activity_id: l.activity_id,
                              title: l.title,
                              proposed: l.proposed,
                              approved: l.approved,
                              status: l.status,
                              comment: l.comment,
                            },
                          });
                          setNote("");
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {(l.status === "draft" || l.status === "rejected") && (
                      <button
                        className="btn"
                        onClick={() =>
                          confirm("Submit this budget line to administration for approval?") &&
                          void runAction(D.setBudgetLineStatus(l.id, "submitted"), "Submitted for approval.")
                        }
                      >
                        Submit for approval · पेस गर्नुहोस्
                      </button>
                    )}
                    {l.status === "draft" && (
                      <button
                        className="btn-danger"
                        onClick={() =>
                          confirm("Permanently delete this draft budget line?") &&
                          void runAction(D.deleteBudgetLine(l.id), "Budget line deleted.")
                        }
                      >
                        Delete
                      </button>
                    )}
                    {admin && l.status === "submitted" && approvingId !== l.id && (
                      <button
                        className="btn"
                        onClick={() => {
                          setApprovingId(l.id);
                          setApproveAmt(l.approved > 0 ? l.approved : l.proposed);
                          setApproveComment(l.comment || "");
                        }}
                      >
                        Decide (Approve / Reject)
                      </button>
                    )}
                    {l.status === "approved" && (
                      <button
                        className="btn-soft"
                        onClick={() =>
                          setRevReq({
                            lineId: l.id,
                            title: l.title,
                            currentApproved: l.approved,
                            amount: l.approved,
                            reason: "",
                          })
                        }
                      >
                        + Request revision · संशोधन माग
                      </button>
                    )}
                  </div>

                  {/* Admin approval box */}
                  {admin && approvingId === l.id && (
                    <div className="mt-3 rounded-md border border-border bg-secondary/30 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="lbl">Approved amount (रु.) · स्वीकृत रकम</label>
                          <input
                            className="field"
                            type="number"
                            min={0}
                            value={approveAmt}
                            onChange={(e) => setApproveAmt(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="lbl">Decision note · प्रशासनको टिप्पणी</label>
                          <input
                            className="field"
                            value={approveComment}
                            onChange={(e) => setApproveComment(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="btn"
                          onClick={() =>
                            void runAction(
                              D.setBudgetLineStatus(l.id, "approved", { approved: approveAmt, comment: approveComment }),
                              "Budget line approved."
                            ).then(() => setApprovingId(""))
                          }
                        >
                          Approve · स्वीकृत
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() =>
                            void runAction(
                              D.setBudgetLineStatus(l.id, "rejected", { comment: approveComment }),
                              "Budget line rejected."
                            ).then(() => setApprovingId(""))
                          }
                        >
                          Reject · अस्वीकृत
                        </button>
                        <button className="btn-soft" onClick={() => setApprovingId("")}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Revision history & pending revision decisions */}
                  {lineRevs.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2">
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">
                        Revision requests · बजेट संशोधन इतिहास ({lineRevs.length})
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {lineRevs.map((rv) => {
                          const rs = revStatus(rv.status);
                          return (
                            <div
                              key={rv.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2"
                            >
                              <div>
                                <b>माग रकम: {money(rv.requested_amount)}</b> — {rv.reason || "No reason"}
                                {rv.decision_comment && (
                                  <span className="ml-2 italic text-muted-foreground">
                                    (निर्णय टिप्पणी: {rv.decision_comment})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={rv.status === "approved" ? "chip-on" : "chip"}>
                                  {rs.en} · {rs.ne}
                                </span>
                                {admin && rv.status === "pending" && (
                                  <>
                                    <button
                                      className="btn !px-2 !py-0.5 text-xs"
                                      onClick={() => {
                                        const c = prompt("Approval comment (optional):") ?? "";
                                        void runAction(
                                          D.decideBudgetRevision(rv.id, true, c),
                                          "Budget revision approved and applied."
                                        );
                                      }}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="btn-danger !px-2 !py-0.5 text-xs"
                                      onClick={() => {
                                        const c = prompt("Reason for rejecting revision:") ?? "";
                                        void runAction(D.decideBudgetRevision(rv.id, false, c), "Budget revision rejected.");
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
            {!yearLines.length && (
              <p className="text-sm text-muted-foreground">No budget lines recorded for this department and year yet.</p>
            )}
          </div>
        </div>
      )}

      {subTab === "expenses" && (
        <div>
          {!expEd && (
            <button
              className="btn mb-3"
              onClick={() => {
                setExpEd({
                  f: {
                    line_id: yearLines[0]?.id ?? null,
                    plan_id: null,
                    activity_id: null,
                    expense_date: todayBs(),
                    description: "",
                    amount: 0,
                    voucher_no: "",
                  },
                });
                setNote("");
              }}
            >
              + Record expense · नयाँ खर्च प्रविष्टि
            </button>
          )}

          {expEd && (
            <section className="panel mb-4 border-primary/40">
              <h3 className="mb-3 text-lg font-bold">
                {expEd.id ? "Edit expense · खर्च सम्पादन" : "Record expense · खर्च प्रविष्टि"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="lbl">Expense date (BS) · खर्च मिति</label>
                  <BsDate
                    value={expEd.f.expense_date}
                    onChange={(v) => setExpEd({ ...expEd, f: { ...expEd.f, expense_date: v } })}
                  />
                </div>
                <div>
                  <label className="lbl">Bill / Voucher No. · बिल वा भौचर नं.</label>
                  <input
                    className="field"
                    value={expEd.f.voucher_no}
                    onChange={(e) => setExpEd({ ...expEd, f: { ...expEd.f, voucher_no: e.target.value } })}
                    placeholder="उदा. V-2083-014"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="lbl">Description / Particulars · खर्चको विवरण *</label>
                  <input
                    className="field"
                    value={expEd.f.description}
                    onChange={(e) => setExpEd({ ...expEd, f: { ...expEd.f, description: e.target.value } })}
                    placeholder="के कामको लागि खर्च भएको हो..."
                  />
                </div>
                <div>
                  <label className="lbl">Amount (रु.) · रकम *</label>
                  <input
                    className="field"
                    type="number"
                    value={expEd.f.amount}
                    onChange={(e) => setExpEd({ ...expEd, f: { ...expEd.f, amount: Number(e.target.value) } })}
                  />
                </div>
                <div>
                  <label className="lbl">Budget line · बजेट शीर्षक</label>
                  <select
                    className="field"
                    value={expEd.f.line_id ?? ""}
                    onChange={(e) => {
                      const lid = e.target.value || null;
                      const ln = lines.find((x) => x.id === lid);
                      setExpEd({
                        ...expEd,
                        f: {
                          ...expEd.f,
                          line_id: lid,
                          plan_id: ln?.plan_id ?? expEd.f.plan_id,
                          activity_id: ln?.activity_id ?? expEd.f.activity_id,
                        },
                      });
                    }}
                  >
                    <option value="">— Select budget line —</option>
                    {yearLines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title} (Approved: {money(l.approved)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Linked plan · सम्बन्धित योजना</label>
                  <select
                    className="field"
                    value={expEd.f.plan_id ?? ""}
                    onChange={(e) => setExpEd({ ...expEd, f: { ...expEd.f, plan_id: e.target.value || null } })}
                  >
                    <option value="">— Optional —</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Linked activity · सम्बन्धित गतिविधि</label>
                  <select
                    className="field"
                    value={expEd.f.activity_id ?? ""}
                    onChange={(e) => setExpEd({ ...expEd, f: { ...expEd.f, activity_id: e.target.value || null } })}
                  >
                    <option value="">— Optional —</option>
                    {acts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn" onClick={() => void saveExpense()}>
                  Save expense
                </button>
                <button className="btn-soft" onClick={() => setExpEd(null)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          <div className="space-y-2">
            {yearExpenses.map((ex) => {
              const lName = lines.find((l) => l.id === ex.line_id)?.title;
              const expEv = evidence.filter((ev) => ev.expense_id === ex.id);
              const isReversal = ex.amount < 0 || !!ex.reversal_of;
              return (
                <section key={ex.id} className="panel">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{ex.description}</span>
                        {ex.voucher_no && <span className="chip text-xs">भौचर: {ex.voucher_no}</span>}
                        {ex.locked && <span className="chip-on text-xs">Locked · लक गरिएको</span>}
                        {isReversal && <span className="chip text-xs">Reversal / सच्याइएको</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        मिति: {ex.expense_date ? fmtBs(ex.expense_date) : "—"}
                        {lName ? ` · बजेट शीर्षक: ${lName}` : ""}
                      </div>
                    </div>
                    <div className={`text-base font-bold ${ex.amount < 0 ? "text-destructive" : "text-primary"}`}>
                      {money(ex.amount)}
                    </div>
                  </div>

                  {/* Expense actions & voucher evidence */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {(!ex.locked || admin) && (
                      <button
                        className="btn-soft"
                        onClick={() =>
                          setExpEd({
                            id: ex.id,
                            f: {
                              line_id: ex.line_id,
                              plan_id: ex.plan_id,
                              activity_id: ex.activity_id,
                              expense_date: ex.expense_date,
                              description: ex.description,
                              amount: ex.amount,
                              voucher_no: ex.voucher_no,
                            },
                          })
                        }
                      >
                        Edit
                      </button>
                    )}
                    {ex.amount > 0 && (
                      <button
                        className="btn-soft"
                        onClick={() =>
                          confirm(`Create a negative reversal entry (${money(-ex.amount)}) to cancel/correct this expense?`) &&
                          void runAction(
                            D.createExpense(dept, {
                              line_id: ex.line_id,
                              plan_id: ex.plan_id,
                              activity_id: ex.activity_id,
                              expense_date: todayBs(),
                              description: `Reversal of: ${ex.description}`,
                              amount: -Math.abs(ex.amount),
                              voucher_no: ex.voucher_no ? `${ex.voucher_no}-REV` : "",
                              reversal_of: ex.id,
                            }),
                            "Reversal entry recorded."
                          )
                        }
                      >
                        Reverse · उल्टाउने (सच्याउने)
                      </button>
                    )}
                    {admin && (
                      <button
                        className="btn-soft"
                        onClick={() =>
                          void runAction(
                            D.setExpenseLocked(ex.id, !ex.locked),
                            ex.locked ? "Expense unlocked." : "Expense locked."
                          )
                        }
                      >
                        {ex.locked ? "Unlock" : "Lock"}
                      </button>
                    )}
                    {admin && !ex.locked && (
                      <button
                        className="btn-danger"
                        onClick={() =>
                          confirm("Permanently delete this expense?") &&
                          void runAction(D.deleteExpense(ex.id), "Expense deleted.")
                        }
                      >
                        Delete
                      </button>
                    )}
                    <label className="btn-soft cursor-pointer">
                      {uploadingExpId === ex.id ? "Uploading…" : "+ Attach bill/voucher"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingExpId === ex.id}
                        accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.docx,.xlsx"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          void handleExpenseUpload(ex.id, f);
                        }}
                      />
                    </label>
                    {expEv.map((ev) => (
                      <span key={ev.id} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5">
                        <button type="button" className="underline" onClick={() => void openEvidence(ev)}>
                          {ev.file_name || "Voucher"}
                        </button>
                        <button
                          type="button"
                          className="text-destructive"
                          onClick={() =>
                            confirm("Remove voucher file?") && void runAction(D.deleteEvidence(ev), "Voucher removed.")
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </section>
              );
            })}
            {!yearExpenses.length && (
              <p className="text-sm text-muted-foreground">No expenses recorded for this department and year yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
