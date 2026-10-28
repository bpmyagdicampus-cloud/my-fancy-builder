import { useCallback, useEffect, useState } from "react";
import { BsDate } from "@/components/app/ui";
import { fmtBs, todayBs } from "@/lib/bs";
import * as D from "@/lib/dm";

const EMPTY: D.PlanForm = { title: "", objectives: "", expected_outcomes: "", indicators: "", targets: "", estimated_budget: 0, funding_source: "", start_date: "", end_date: "" };
const STATUS_LABEL = (k: string) => D.PLAN_STATUS.find((s) => s.k === k);
const money = (n: number) => `रु. ${Number(n || 0).toLocaleString("en-IN")}`;

/** Annual plans of one department and academic year: create, edit, submit, approve, history. */
export function PlansTab({ dept, year, admin, canManage, onChanged }: { dept: string; year: string; admin: boolean; canManage: boolean; onChanged: () => void }) {
  const [plans, setPlans] = useState<D.DmPlan[]>([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [ed, setEd] = useState<{ id?: string; f: D.PlanForm } | null>(null);
  const [open, setOpen] = useState<string>("");
  const [revs, setRevs] = useState<D.PlanRevision[]>([]);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (!dept || !year) { setPlans([]); return; }
    const r = await D.loadPlans(dept, year);
    if (r.ok) { setPlans(r.data); setErr(""); } else setErr(r.error);
  }, [dept, year]);
  useEffect(() => { void load(); setOpen(""); setEd(null); }, [load]);
  useEffect(() => {
    if (!open) { setRevs([]); return; }
    void D.loadRevisions(open).then((r) => setRevs(r.ok ? r.data : []));
  }, [open, plans]);

  const act = async (p: Promise<{ ok: boolean; error?: string }>, ok: string) => {
    const r = await p;
    if (r.ok) { setNote(ok); await load(); onChanged(); } else setNote((r as { error?: string }).error ?? "Failed.");
    return r.ok;
  };

  const save = async () => {
    if (!ed) return;
    const f = { ...ed.f, title: ed.f.title.trim(), estimated_budget: Math.max(0, Number(ed.f.estimated_budget) || 0) };
    if (!f.title) { setNote("Please write the plan title."); return; }
    if (!year) { setNote("Choose an academic year first."); return; }
    const ok = await act(ed.id ? D.updatePlan(ed.id, f) : D.createPlan(dept, year, f), ed.id ? "Plan saved." : "Plan created as a draft.");
    if (ok) setEd(null);
  };

  const field = (k: keyof D.PlanForm, l: string, area = false) => (
    <div className={area ? "sm:col-span-2" : ""}>
      <label className="lbl">{l}</label>
      {area
        ? <textarea className="field min-h-20" value={String(ed!.f[k] ?? "")} onChange={(e) => setEd({ ...ed!, f: { ...ed!.f, [k]: e.target.value } })} />
        : <input className="field" value={String(ed!.f[k] ?? "")} onChange={(e) => setEd({ ...ed!, f: { ...ed!.f, [k]: e.target.value } })} />}
    </div>
  );
  const dateField = (k: "start_date" | "end_date", l: string) => (
    <div><label className="lbl">{l}</label>
      {ed!.f[k]
        ? <div className="flex items-center gap-2"><BsDate value={ed!.f[k]} onChange={(v) => setEd({ ...ed!, f: { ...ed!.f, [k]: v } })} /><button type="button" className="btn-soft" onClick={() => setEd({ ...ed!, f: { ...ed!.f, [k]: "" } })}>Clear</button></div>
        : <button type="button" className="btn-soft" onClick={() => setEd({ ...ed!, f: { ...ed!.f, [k]: todayBs() } })}>+ Set date</button>}
    </div>
  );

  const block = (l: string, v: string) => v.trim() ? <div className="mb-2"><div className="text-xs font-semibold text-muted-foreground">{l}</div><div className="whitespace-pre-line text-sm">{v}</div></div> : null;

  return (
    <div>
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      {err && <p className="mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}

      {canManage && !ed && <button className="btn mb-3" disabled={!year} onClick={() => { setEd({ f: { ...EMPTY } }); setNote(""); }}>+ New annual plan · नयाँ वार्षिक योजना</button>}

      {ed && (
        <section className="panel mb-4">
          <h2 className="mb-3 text-lg font-bold">{ed.id ? "Edit plan · योजना सम्पादन" : "New plan · नयाँ योजना"} <span className="text-sm font-normal text-muted-foreground">({year})</span></h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("title", "Plan / programme title · योजना वा कार्यक्रम", true)}
            {field("objectives", "Objectives · उद्देश्य", true)}
            {field("expected_outcomes", "Expected outcomes · अपेक्षित उपलब्धि", true)}
            {field("indicators", "Indicators · सूचक", true)}
            {field("targets", "Targets · लक्ष्य", true)}
            {dateField("start_date", "Start date · सुरु मिति")}
            {dateField("end_date", "End date · अन्तिम मिति")}
            <div><label className="lbl">Estimated budget (रु.) · अनुमानित बजेट</label><input className="field" type="number" min={0} value={ed.f.estimated_budget} onChange={(e) => setEd({ ...ed, f: { ...ed.f, estimated_budget: Number(e.target.value) } })} /></div>
            {field("funding_source", "Funding source · स्रोत")}
          </div>
          <div className="mt-3 flex gap-2"><button className="btn" onClick={() => void save()}>Save</button><button className="btn-soft" onClick={() => setEd(null)}>Cancel</button></div>
        </section>
      )}

      <div className="space-y-3">
        {plans.map((p) => {
          const st = STATUS_LABEL(p.status);
          const lockedForHead = p.status === "approved" && !admin;
          const isOpen = open === p.id;
          return (
            <section key={p.id} className="panel">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold">{p.title}</h3>
                  <div className="text-xs text-muted-foreground">{p.start_date ? fmtBs(p.start_date) : "—"} → {p.end_date ? fmtBs(p.end_date) : "—"} · {money(p.estimated_budget)} · v{p.version}</div>
                </div>
                <span className={p.status === "approved" ? "chip-on" : "chip"}>{st?.en} · {st?.ne}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-soft" onClick={() => setOpen(isOpen ? "" : p.id)}>{isOpen ? "Hide details" : "View details"}</button>
                {canManage && !lockedForHead && <button className="btn-soft" onClick={() => { setEd({ id: p.id, f: { title: p.title, objectives: p.objectives, expected_outcomes: p.expected_outcomes, indicators: p.indicators, targets: p.targets, estimated_budget: p.estimated_budget, funding_source: p.funding_source, start_date: p.start_date, end_date: p.end_date } }); setNote(""); }}>Edit</button>}
                {canManage && <button className="btn-soft" onClick={() => void act(D.createPlan(dept, year, { title: `${p.title} (copy)`, objectives: p.objectives, expected_outcomes: p.expected_outcomes, indicators: p.indicators, targets: p.targets, estimated_budget: p.estimated_budget, funding_source: p.funding_source, start_date: p.start_date, end_date: p.end_date }), "A copy was created as a new draft.")}>Copy as new</button>}
                {canManage && (p.status === "draft" || p.status === "rejected") && <button className="btn" onClick={() => confirm("Submit this plan to the administration for approval?") && void act(D.setPlanStatus(p.id, "submitted"), "Submitted for approval.")}>Submit for approval</button>}
                {canManage && p.status === "draft" && <button className="btn-danger" onClick={() => confirm("Do you want to permanently delete this?") && void act(D.deletePlan(p.id), "Deleted.")}>Delete</button>}
                {admin && p.status === "approved" && <button className="btn-soft" onClick={() => confirm("Reopen this approved plan as a draft so it can be revised?") && void act(D.setPlanStatus(p.id, "draft", p.approval_comment), "Reopened as a draft.")}>Reopen for revision</button>}
              </div>
              {lockedForHead && <p className="mt-2 text-xs text-muted-foreground">An approved plan is locked. Use “Copy as new” to prepare a revised plan, or ask the administration to reopen it.</p>}

              {admin && p.status === "submitted" && (
                <div className="mt-3 rounded-md border border-border p-3">
                  <label className="lbl">Approval comment · टिप्पणी</label>
                  <textarea className="field" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <div className="mt-2 flex gap-2">
                    <button className="btn" onClick={() => confirm("Approve this plan?") && void act(D.setPlanStatus(p.id, "approved", comment), "Plan approved.").then(() => setComment(""))}>Approve · स्वीकृत</button>
                    <button className="btn-danger" onClick={() => confirm("Reject this plan?") && void act(D.setPlanStatus(p.id, "rejected", comment), "Plan rejected.").then(() => setComment(""))}>Reject · अस्वीकृत</button>
                  </div>
                </div>
              )}

              {isOpen && (
                <div className="mt-3 border-t border-border pt-3">
                  {block("Objectives · उद्देश्य", p.objectives)}
                  {block("Expected outcomes · अपेक्षित उपलब्धि", p.expected_outcomes)}
                  {block("Indicators · सूचक", p.indicators)}
                  {block("Targets · लक्ष्य", p.targets)}
                  {block("Funding source · स्रोत", p.funding_source)}
                  {block("Approval comment · टिप्पणी", p.approval_comment)}
                  <div className="mt-3">
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Revision history · परिवर्तनको इतिहास</div>
                    {revs.length ? (
                      <table className="w-full text-xs"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-1">Version</th><th className="p-1">Changed</th><th className="p-1">Status then</th><th className="p-1">Title then</th><th className="p-1">Budget then</th></tr></thead>
                        <tbody>{revs.map((r) => <tr key={r.id} className="border-b border-border"><td className="p-1">v{r.version}</td><td className="p-1">{new Date(r.changed_at).toLocaleString()}</td><td className="p-1">{String(r.snapshot.status ?? "")}</td><td className="p-1">{String(r.snapshot.title ?? "")}</td><td className="p-1">{money(Number(r.snapshot.estimated_budget ?? 0))}</td></tr>)}</tbody></table>
                    ) : <p className="text-xs text-muted-foreground">No earlier versions yet. A version is saved every time the plan changes.</p>}
                  </div>
                </div>
              )}
            </section>
          );
        })}
        {!plans.length && !err && <p className="text-sm text-muted-foreground">No annual plan yet for this department and year.{canManage ? " Press “New annual plan” to start." : ""}</p>}
      </div>
    </div>
  );
}
