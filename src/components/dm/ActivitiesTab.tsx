import { useCallback, useEffect, useState } from "react";
import { BsDate } from "@/components/app/ui";
import { fmtBs, todayBs } from "@/lib/bs";
import * as D from "@/lib/dm";

const money = (n: number) => `रु. ${Number(n || 0).toLocaleString("en-IN")}`;
const statusInfo = (k: string) => D.ACT_STATUS.find((s) => s.k === k) ?? { k, en: k, ne: k };
const catInfo = (k: string) => D.ACT_CATEGORIES.find((c) => c.k === k) ?? { k, en: k, ne: k };

const EMPTY_FORM: D.ActivityForm = {
  plan_id: null,
  title: "",
  category: "academic",
  activity_date: todayBs(),
  deadline: "",
  responsible_user_id: null,
  responsible_name: "",
  participants: "",
  planned_output: "",
  actual_output: "",
  status: "planned",
  progress_pct: 0,
  budget_amount: 0,
  challenges: "",
  corrective_actions: "",
  next_steps: "",
};

export function ActivitiesTab({
  dept,
  deptName,
  year,
  userId,
  canManage,
  onChanged,
}: {
  dept: string;
  deptName: string;
  year: string;
  userId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [acts, setActs] = useState<D.DmActivity[]>([]);
  const [plans, setPlans] = useState<D.DmPlan[]>([]);
  const [evidence, setEvidence] = useState<D.DmEvidence[]>([]);
  const [teachers, setTeachers] = useState<D.DeptTeacher[]>([]);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const [onlyMine, setOnlyMine] = useState(false);

  // Full editor (for Admin / HOD)
  const [ed, setEd] = useState<{ id?: string; f: D.ActivityForm } | null>(null);
  // Progress-only editor (for assigned teacher or quick update)
  const [progEd, setProgEd] = useState<{ id: string; title: string; p: D.ActivityProgressPatch } | null>(null);
  // Expanded details activity id
  const [openId, setOpenId] = useState<string>("");
  const [uploadingId, setUploadingId] = useState<string>("");

  const load = useCallback(async () => {
    if (!dept || !year) {
      setActs([]);
      setPlans([]);
      setEvidence([]);
      return;
    }
    const [aRes, pRes, eRes, tList] = await Promise.all([
      D.loadActivities(dept, year),
      D.loadPlans(dept, year),
      D.loadEvidence(dept),
      D.loadDeptTeachers(dept, deptName),
    ]);
    if (aRes.ok) {
      setActs(aRes.data);
      setErr("");
    } else setErr(aRes.error);
    if (pRes.ok) setPlans(pRes.data);
    if (eRes.ok) setEvidence(eRes.data);
    setTeachers(tList);
  }, [dept, deptName, year]);

  useEffect(() => {
    void load();
    setEd(null);
    setProgEd(null);
    setOpenId("");
  }, [load]);

  const runAction = async (p: Promise<{ ok: boolean; error?: string }>, successMsg: string) => {
    const r = await p;
    if (r.ok) {
      setNote(successMsg);
      await load();
      onChanged();
    } else {
      setNote(r.error ?? "Action failed.");
    }
    return r.ok;
  };

  const saveFull = async () => {
    if (!ed) return;
    const title = ed.f.title.trim();
    if (!title) {
      setNote("Please enter the activity title · गतिविधिको शीर्षक लेख्नुहोस्।");
      return;
    }
    if (!year) {
      setNote("Choose an academic year first.");
      return;
    }
    const payload: D.ActivityForm = {
      ...ed.f,
      title,
      progress_pct: ed.f.status === "completed" && ed.f.progress_pct === 0 ? 100 : ed.f.progress_pct,
    };
    const ok = await runAction(
      ed.id ? D.updateActivity(ed.id, payload) : D.createActivity(dept, year, payload),
      ed.id ? "Activity updated · गतिविधि अद्यावधिक भयो।" : "Activity added · नयाँ गतिविधि थपियो।"
    );
    if (ok) setEd(null);
  };

  const saveProgress = async () => {
    if (!progEd) return;
    const patch: D.ActivityProgressPatch = {
      ...progEd.p,
      progress_pct: progEd.p.status === "completed" && progEd.p.progress_pct < 100 ? 100 : progEd.p.progress_pct,
    };
    const ok = await runAction(
      D.updateActivityProgress(progEd.id, patch),
      "Progress saved · प्रगति विवरण सुरक्षित भयो।"
    );
    if (ok) setProgEd(null);
  };

  const handleUpload = async (activityId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingId(activityId);
    setNote("");
    const r = await D.uploadEvidence({ dept, activityId, file });
    setUploadingId("");
    if (r.ok) {
      setNote(`Uploaded "${file.name}" · प्रमाण फाइल अपलोड भयो।`);
      await load();
    } else {
      setNote(r.error);
    }
  };

  const openEvidence = async (ev: D.DmEvidence) => {
    const r = await D.getEvidenceUrl(ev.file_path);
    if (r.ok) window.open(r.data, "_blank", "noopener,noreferrer");
    else alert(r.error);
  };

  const filtered = acts.filter((a) => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterPlan && (a.plan_id ?? "") !== filterPlan) return false;
    if (onlyMine && a.responsible_user_id !== userId) return false;
    return true;
  });

  const planTitle = (id: string | null) => plans.find((p) => p.id === id)?.title ?? "";

  return (
    <div>
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      {err && <p className="mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}

      {/* Top controls & filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {canManage && !ed && (
          <button
            className="btn"
            disabled={!year}
            onClick={() => {
              setEd({ f: { ...EMPTY_FORM, activity_date: todayBs() } });
              setProgEd(null);
              setNote("");
            }}
          >
            + New activity · नयाँ गतिविधि
          </button>
        )}
        <div>
          <label className="lbl">Status · स्थिति</label>
          <select className="field" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses ({acts.length})</option>
            {D.ACT_STATUS.map((s) => (
              <option key={s.k} value={s.k}>
                {s.en} · {s.ne} ({acts.filter((x) => x.status === s.k).length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Annual plan · वार्षिक योजना</label>
          <select className="field" value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          <span>Assigned to me · मेरो जिम्मेवारी मात्र</span>
        </label>
      </div>

      {/* Full create/edit modal panel (HOD / Admin) */}
      {ed && (
        <section className="panel mb-4 border-primary/40">
          <h2 className="mb-3 text-lg font-bold">
            {ed.id ? "Edit activity · गतिविधि सम्पादन" : "New activity · नयाँ गतिविधि"}{" "}
            <span className="text-sm font-normal text-muted-foreground">({year})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="lbl">Activity title · गतिविधिको नाम *</label>
              <input
                className="field"
                value={ed.f.title}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, title: e.target.value } })}
                placeholder="उदा. अनुसन्धान लेखन कार्यशाला / Research Writing Workshop"
              />
            </div>

            <div>
              <label className="lbl">Category · प्रकार</label>
              <select
                className="field"
                value={ed.f.category}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, category: e.target.value } })}
              >
                {D.ACT_CATEGORIES.map((c) => (
                  <option key={c.k} value={c.k}>
                    {c.en} · {c.ne}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="lbl">Linked annual plan · सम्बन्धित वार्षिक योजना</label>
              <select
                className="field"
                value={ed.f.plan_id ?? ""}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, plan_id: e.target.value || null } })}
              >
                <option value="">— Independent / कुनै योजनासँग नजोडिएको —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="lbl">Start / Activity date (BS) · सञ्चालन मिति</label>
              {ed.f.activity_date ? (
                <div className="flex items-center gap-2">
                  <BsDate value={ed.f.activity_date} onChange={(v) => setEd({ ...ed, f: { ...ed.f, activity_date: v } })} />
                  <button type="button" className="btn-soft" onClick={() => setEd({ ...ed, f: { ...ed.f, activity_date: "" } })}>
                    Clear
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-soft" onClick={() => setEd({ ...ed, f: { ...ed.f, activity_date: todayBs() } })}>
                  + Set date
                </button>
              )}
            </div>

            <div>
              <label className="lbl">Deadline (BS) · सम्पन्न गर्ने समयसीमा</label>
              {ed.f.deadline ? (
                <div className="flex items-center gap-2">
                  <BsDate value={ed.f.deadline} onChange={(v) => setEd({ ...ed, f: { ...ed.f, deadline: v } })} />
                  <button type="button" className="btn-soft" onClick={() => setEd({ ...ed, f: { ...ed.f, deadline: "" } })}>
                    Clear
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-soft" onClick={() => setEd({ ...ed, f: { ...ed.f, deadline: todayBs() } })}>
                  + Set deadline
                </button>
              )}
            </div>

            <div>
              <label className="lbl">Assign teacher · जिम्मेवार शिक्षक छान्नुहोस्</label>
              <select
                className="field"
                value={ed.f.responsible_user_id ?? ""}
                onChange={(e) => {
                  const uid = e.target.value || null;
                  const t = teachers.find((x) => x.user_id === uid);
                  setEd({
                    ...ed,
                    f: {
                      ...ed.f,
                      responsible_user_id: uid,
                      responsible_name: t ? t.name : ed.f.responsible_name,
                    },
                  });
                }}
              >
                <option value="">— Select teacher (optional) —</option>
                {teachers.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.name} {t.designation ? `(${t.designation})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="lbl">Responsible person / team name · जिम्मेवार व्यक्ति वा समूह</label>
              <input
                className="field"
                value={ed.f.responsible_name}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, responsible_name: e.target.value } })}
                placeholder="शिक्षक वा समितिको नाम"
              />
            </div>

            <div>
              <label className="lbl">Participants / Target group · सहभागी संख्या वा लक्षित समूह</label>
              <input
                className="field"
                value={ed.f.participants}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, participants: e.target.value } })}
                placeholder="उदा. ४५ जना विद्यार्थी र ८ जना शिक्षक"
              />
            </div>

            <div>
              <label className="lbl">Allocated budget (रु.) · अनुमानित लागत</label>
              <input
                className="field"
                type="number"
                min={0}
                value={ed.f.budget_amount}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, budget_amount: Number(e.target.value) } })}
              />
            </div>

            <div>
              <label className="lbl">Status · हालको स्थिति</label>
              <select
                className="field"
                value={ed.f.status}
                onChange={(e) => {
                  const st = e.target.value as D.ActStatus;
                  setEd({
                    ...ed,
                    f: {
                      ...ed.f,
                      status: st,
                      progress_pct: st === "completed" ? 100 : ed.f.progress_pct,
                    },
                  });
                }}
              >
                {D.ACT_STATUS.map((s) => (
                  <option key={s.k} value={s.k}>
                    {s.en} · {s.ne}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="lbl">Progress (%) · प्रगति प्रतिशत: {ed.f.progress_pct}%</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                  value={ed.f.progress_pct}
                  onChange={(e) => setEd({ ...ed, f: { ...ed.f, progress_pct: Number(e.target.value) } })}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field w-20"
                  value={ed.f.progress_pct}
                  onChange={(e) => setEd({ ...ed, f: { ...ed.f, progress_pct: Number(e.target.value) } })}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="lbl">Planned output · अपेक्षित प्रतिफल</label>
              <textarea
                className="field min-h-16"
                value={ed.f.planned_output}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, planned_output: e.target.value } })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="lbl">Actual output / achievement · वास्तविक उपलब्धि</label>
              <textarea
                className="field min-h-16"
                value={ed.f.actual_output}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, actual_output: e.target.value } })}
              />
            </div>

            <div>
              <label className="lbl">Challenges faced · देखापरेका चुनौतीहरू</label>
              <textarea
                className="field min-h-16"
                value={ed.f.challenges}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, challenges: e.target.value } })}
              />
            </div>

            <div>
              <label className="lbl">Corrective actions & Next steps · सुधारात्मक कदम र आगामी कार्य</label>
              <textarea
                className="field min-h-16"
                value={ed.f.corrective_actions}
                onChange={(e) => setEd({ ...ed, f: { ...ed.f, corrective_actions: e.target.value } })}
                placeholder="सुधारात्मक प्रयास..."
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={() => void saveFull()}>
              Save · सुरक्षित गर्नुहोस्
            </button>
            <button className="btn-soft" onClick={() => setEd(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Progress-only modal for assigned teacher or quick update */}
      {progEd && (
        <section className="panel mb-4 border-primary/40">
          <h2 className="mb-1 text-lg font-bold">Update Progress · प्रगति विवरण अद्यावधिक</h2>
          <p className="mb-3 text-sm text-muted-foreground">{progEd.title}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="lbl">Status · स्थिति</label>
              <select
                className="field"
                value={progEd.p.status}
                onChange={(e) => {
                  const st = e.target.value as D.ActStatus;
                  setProgEd({
                    ...progEd,
                    p: { ...progEd.p, status: st, progress_pct: st === "completed" ? 100 : progEd.p.progress_pct },
                  });
                }}
              >
                {D.ACT_STATUS.map((s) => (
                  <option key={s.k} value={s.k}>
                    {s.en} · {s.ne}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">Progress (%) · प्रगति प्रतिशत: {progEd.p.progress_pct}%</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="flex-1"
                  value={progEd.p.progress_pct}
                  onChange={(e) => setProgEd({ ...progEd, p: { ...progEd.p, progress_pct: Number(e.target.value) } })}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field w-20"
                  value={progEd.p.progress_pct}
                  onChange={(e) => setProgEd({ ...progEd, p: { ...progEd.p, progress_pct: Number(e.target.value) } })}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="lbl">Actual output / achievement · हालसम्मको वास्तविक उपलब्धि</label>
              <textarea
                className="field min-h-16"
                value={progEd.p.actual_output}
                onChange={(e) => setProgEd({ ...progEd, p: { ...progEd.p, actual_output: e.target.value } })}
              />
            </div>
            <div>
              <label className="lbl">Challenges · समस्या वा चुनौतीहरू</label>
              <textarea
                className="field min-h-16"
                value={progEd.p.challenges}
                onChange={(e) => setProgEd({ ...progEd, p: { ...progEd.p, challenges: e.target.value } })}
              />
            </div>
            <div>
              <label className="lbl">Corrective actions · समाधानका उपाय</label>
              <textarea
                className="field min-h-16"
                value={progEd.p.corrective_actions}
                onChange={(e) => setProgEd({ ...progEd, p: { ...progEd.p, corrective_actions: e.target.value } })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="lbl">Next steps · आगामी कार्ययोजना</label>
              <textarea
                className="field min-h-14"
                value={progEd.p.next_steps}
                onChange={(e) => setProgEd({ ...progEd, p: { ...progEd.p, next_steps: e.target.value } })}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={() => void saveProgress()}>
              Save progress · प्रगति सुरक्षित गर्नुहोस्
            </button>
            <button className="btn-soft" onClick={() => setProgEd(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Activities list */}
      <div className="space-y-3">
        {filtered.map((a) => {
          const st = statusInfo(a.status);
          const cat = catInfo(a.category);
          const pName = planTitle(a.plan_id);
          const isMine = a.responsible_user_id === userId;
          const canUpdateProgress = canManage || isMine;
          const actEv = evidence.filter((ev) => ev.activity_id === a.id);
          const isOpen = openId === a.id;

          return (
            <section key={a.id} className="panel">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold">{a.title}</h3>
                    <span className="chip text-xs">{cat.ne}</span>
                    {isMine && <span className="chip-on text-xs">मेरो जिम्मेवारी · Assigned to me</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.activity_date ? `मिति: ${fmtBs(a.activity_date)}` : "मिति तोकिएको छैन"}
                    {a.deadline ? ` · समयसीमा: ${fmtBs(a.deadline)}` : ""}
                    {a.responsible_name ? ` · जिम्मेवार: ${a.responsible_name}` : ""}
                    {a.budget_amount > 0 ? ` · बजेट: ${money(a.budget_amount)}` : ""}
                    {pName ? ` · योजना: ${pName}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">{a.progress_pct}%</span>
                  <span className={a.status === "completed" ? "chip-on" : "chip"}>
                    {st.en} · {st.ne}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, a.progress_pct))}%` }}
                />
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn-soft" onClick={() => setOpenId(isOpen ? "" : a.id)}>
                  {isOpen ? "Hide details" : `Details & Evidence (${actEv.length})`}
                </button>
                {canUpdateProgress && (
                  <button
                    className="btn-soft"
                    onClick={() => {
                      setProgEd({
                        id: a.id,
                        title: a.title,
                        p: {
                          actual_output: a.actual_output,
                          status: a.status,
                          progress_pct: a.progress_pct,
                          challenges: a.challenges,
                          corrective_actions: a.corrective_actions,
                          next_steps: a.next_steps,
                        },
                      });
                      setEd(null);
                      setNote("");
                    }}
                  >
                    Update progress · प्रगति अपडेट
                  </button>
                )}
                {canManage && (
                  <button
                    className="btn-soft"
                    onClick={() => {
                      setEd({
                        id: a.id,
                        f: {
                          plan_id: a.plan_id,
                          title: a.title,
                          category: a.category,
                          activity_date: a.activity_date,
                          deadline: a.deadline,
                          responsible_user_id: a.responsible_user_id,
                          responsible_name: a.responsible_name,
                          participants: a.participants,
                          planned_output: a.planned_output,
                          actual_output: a.actual_output,
                          status: a.status,
                          progress_pct: a.progress_pct,
                          budget_amount: a.budget_amount,
                          challenges: a.challenges,
                          corrective_actions: a.corrective_actions,
                          next_steps: a.next_steps,
                        },
                      });
                      setProgEd(null);
                      setNote("");
                    }}
                  >
                    Edit
                  </button>
                )}
                {canManage && (
                  <button
                    className="btn-danger"
                    onClick={() =>
                      confirm("Do you want to permanently delete this activity?") &&
                      void runAction(D.deleteActivity(a.id), "Activity deleted.")
                    }
                  >
                    Delete
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                  {a.participants && (
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">Participants · सहभागी: </span>
                      <span>{a.participants}</span>
                    </div>
                  )}
                  {a.planned_output && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Planned output · अपेक्षित प्रतिफल</div>
                      <div className="whitespace-pre-line">{a.planned_output}</div>
                    </div>
                  )}
                  {a.actual_output && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Actual output · वास्तविक उपलब्धि</div>
                      <div className="whitespace-pre-line">{a.actual_output}</div>
                    </div>
                  )}
                  {a.challenges && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Challenges · चुनौतीहरू</div>
                      <div className="whitespace-pre-line">{a.challenges}</div>
                    </div>
                  )}
                  {a.corrective_actions && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Corrective actions · सुधारात्मक कदम</div>
                      <div className="whitespace-pre-line">{a.corrective_actions}</div>
                    </div>
                  )}
                  {a.next_steps && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">Next steps · आगामी कार्य</div>
                      <div className="whitespace-pre-line">{a.next_steps}</div>
                    </div>
                  )}

                  {/* Evidence files */}
                  <div className="mt-3 rounded-md border border-border bg-secondary/20 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Evidence & Documents · प्रमाण तथा कागजात ({actEv.length})
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Photos, attendance sheets, minutes or PDF/Word/Excel reports (max 10 MB)
                        </div>
                      </div>
                      {canUpdateProgress && (
                        <label className="btn-soft cursor-pointer text-xs">
                          {uploadingId === a.id ? "Uploading…" : "+ Upload file · प्रमाण थप्नुहोस्"}
                          <input
                            type="file"
                            className="hidden"
                            disabled={uploadingId === a.id}
                            accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.docx,.xlsx"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              void handleUpload(a.id, f);
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {actEv.length > 0 ? (
                      <ul className="divide-y divide-border text-xs">
                        {actEv.map((ev) => (
                          <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                            <span className="font-medium">{ev.file_name || ev.file_path.split("/").pop()}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {Math.max(1, Math.round((ev.size_bytes || 0) / 1024))} KB ·{" "}
                                {new Date(ev.uploaded_at).toLocaleDateString()}
                              </span>
                              <button type="button" className="btn-soft !px-2 !py-0.5" onClick={() => void openEvidence(ev)}>
                                Open · हेर्नुहोस्
                              </button>
                              {canManage && (
                                <button
                                  type="button"
                                  className="btn-danger !px-2 !py-0.5"
                                  onClick={() =>
                                    confirm("Delete this evidence file?") &&
                                    void runAction(D.deleteEvidence(ev), "Evidence file removed.")
                                  }
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No evidence files uploaded for this activity yet.</p>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}

        {!filtered.length && !err && (
          <p className="text-sm text-muted-foreground">
            No activities found for this selection.{canManage ? " Click “+ New activity” above to add one." : ""}
          </p>
        )}
      </div>
    </div>
  );
}
