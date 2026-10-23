import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page, Collection, Dt, NeedProfile } from "@/components/app/ui";
import { updateData, uid, useTeacher, type Cls } from "@/lib/store";
import { weeklyOffOf } from "@/lib/migrate";
import { CAL_TYPES } from "@/lib/constants";
import { useCloud } from "@/lib/cloud";
import { addStudents, classStudents, moveStudents, renameStudent, setActive, setRoll } from "@/lib/students";
import { currentYear } from "@/lib/years";
import { adminListUsers, type AdminUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [
    { title: "Setup — शिक्षक डायरी · Teacher's Diary" },
    { name: "description", content: "Institutional profile, departments, classes, students and academic calendar." },
    { property: "og:title", content: "Setup — शिक्षक डायरी" },
  ] }),
  component: Setup,
});

function Setup() {
  const { profile, data } = useTeacher();
  const c = useCloud();
  const local = c.status === "anon" && c.localMode;
  const isAdmin = local || (c.status === "ready" && c.roles.includes("admin"));
  const isDepartmentHead = c.roles.includes("department_head");
  const headDepartmentId = data.departments.find((d) => d.active !== false && d.name.trim().toLowerCase() === (c.me?.dept ?? "").trim().toLowerCase())?.id ?? "";
  const canManageClasses = local || (c.status === "ready" && (c.roles.includes("admin") || (isDepartmentHead && !!headDepartmentId)));
  const [campusUsers, setCampusUsers] = useState<AdminUser[]>([]);
  useEffect(() => {
    if (c.status !== "ready" || !c.roles.includes("admin")) return;
    let alive = true;
    void (async () => {
      try { const result = await (adminListUsers as any)({ data: {} }); if (alive && result?.ok) setCampusUsers(result.users ?? []); } catch { /* manual names remain editable */ }
    })();
    return () => { alive = false; };
  }, [c.status, c.userId, isAdmin]);
  if (!profile) return <NeedProfile />;

  const institution = {
    name: data.settings.institution?.name || profile.campus || "",
    address: data.settings.institution?.address || profile.address || "",
    website: data.settings.institution?.website || "",
    email: data.settings.institution?.email || "",
    phone: data.settings.institution?.phone || "",
    departmentHead: data.settings.institution?.departmentHead || profile.hod || "",
    campusChief: data.settings.institution?.campusChief || profile.chief || "",
  };
  const setInstitution = (key: keyof typeof institution, val: string) => updateData((d) => {
    d.settings = { ...d.settings, institution: { ...institution, ...(d.settings.institution ?? {}), [key]: val } };
  });

  return (
    <Page title="सेटअप · Setup" sub="Institutional details, departments, classes, students, weekly holidays and the academic calendar. Campus settings are controlled by Admin.">
      <section className="panel relative mb-4 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-cyan-500 to-emerald-500" />
        <div className="mb-3 flex flex-wrap items-start gap-3 pt-1">
          <div className="flex-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Official campus record</p><h2 className="text-xl font-bold">Institutional Profile · संस्थागत विवरण</h2><p className="mt-1 text-sm text-muted-foreground">यो विवरण नै ड्यासबोर्ड, पाठयोजना र प्रतिवेदनमा प्रयोग हुन्छ। परिवर्तन Admin ले मात्र गर्न सक्छ।</p></div>
          {!isAdmin && <span className="chip self-start">View only · हेर्न मात्र</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label><span className="lbl">Campus / Institution name</span><input className="field" value={institution.name} readOnly={!isAdmin} onChange={(e) => setInstitution("name", e.target.value)} placeholder="Myagdi Multiple Campus" /></label>
          <label><span className="lbl">Address</span><input className="field" value={institution.address} readOnly={!isAdmin} onChange={(e) => setInstitution("address", e.target.value)} placeholder="Campus address" /></label>
          <label><span className="lbl">Website</span><input className="field" type="url" value={institution.website} readOnly={!isAdmin} onChange={(e) => setInstitution("website", e.target.value)} placeholder="https://example.edu.np" /></label>
          <label><span className="lbl">Institution email</span><input className="field" type="email" value={institution.email} readOnly={!isAdmin} onChange={(e) => setInstitution("email", e.target.value)} placeholder="info@example.edu.np" /></label>
          <label><span className="lbl">Institution phone</span><input className="field" value={institution.phone} readOnly={!isAdmin} onChange={(e) => setInstitution("phone", e.target.value)} placeholder="Campus phone" /></label>
          <label><span className="lbl">Department Head · विभागीय प्रमुख</span><input className="field" list="department-head-options" value={institution.departmentHead} readOnly={!isAdmin} onChange={(e) => setInstitution("departmentHead", e.target.value)} placeholder="Choose or type a name" /><datalist id="department-head-options">{campusUsers.filter((u) => u.roles.includes("department_head")).map((u) => <option key={u.id} value={u.name} label={`${u.name} · ${u.dept || "No department"}`} />)}</datalist><span className="mt-1 block text-[11px] text-muted-foreground">Admin can choose a Department Head account or enter another name.</span></label>
          <label><span className="lbl">Campus Chief · क्याम्पस प्रमुख</span><input className="field" list="campus-chief-options" value={institution.campusChief} readOnly={!isAdmin} onChange={(e) => setInstitution("campusChief", e.target.value)} placeholder="Choose or type a name" /><datalist id="campus-chief-options">{campusUsers.map((u) => <option key={u.id} value={u.name} label={`${u.name} · ${u.designation || u.roles.join(", ")}`} />)}</datalist><span className="mt-1 block text-[11px] text-muted-foreground">Admin can choose a campus account or enter another name.</span></label>
        </div>
        {isAdmin && <p className="mt-3 text-xs text-muted-foreground">Changes are saved automatically to this signed-in account. Wait for “Saved ✓” before leaving.</p>}
      </section>

      <section className="panel mb-4">
        <div className="mb-3 flex flex-wrap items-start gap-3"><div className="flex-1"><h2 className="text-lg font-bold">Departments · विभागहरू</h2><p className="text-sm text-muted-foreground">Admin can add/edit the institutional department list. Other authorized users can view it and select the appropriate department.</p></div>{!isAdmin && <span className="chip">View only</span>}</div>
        <Collection k="departments" title="Department list" readOnly={!isAdmin} sort={(a, b) => a.name.localeCompare(b.name)}
          fields={[{ k: "name", l: "Department name" }, { k: "code", l: "Department code" }]}
          defaults={{ active: true }} summary={(d) => <><b>{d.name}</b>{d.code ? ` · ${d.code}` : ""}{d.active === false && <span className="chip ml-2">Inactive</span>}</>} />
      </section>

      {isDepartmentHead && !isAdmin && !headDepartmentId && <div className="mb-3 rounded-lg border border-destructive/40 p-3 text-sm">तपाईंको खातामा विभाग तोकिएको छैन। Admin ले Admin → Accounts बाट Department चयन गरेपछि मात्र आफ्नो विभागको कक्षा/विद्यार्थी व्यवस्थापन गर्न सक्नुहुन्छ।</div>}
      <ClassSetup canManage={canManageClasses} departmentScope={isDepartmentHead && !isAdmin ? headDepartmentId : ""} />

      <section className="panel mb-4">
        <div className="flex flex-wrap items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary">◷</div><div className="min-w-0 flex-1"><h2 className="text-lg font-bold">Academic year · शैक्षिक वर्ष</h2><p className="text-sm text-muted-foreground">Currently open: <b>{currentYear(data)?.name || "Not configured"}</b>{c.activeYear ? ` · Administrator's active year: ${c.activeYear.name}` : ""}. Past-year records remain available.</p></div><Link to="/years" className="btn-soft">Manage years & history ↗</Link>{isAdmin && <Link to="/admin" className="btn-soft">Set active year in Admin ↗</Link>}</div>
      </section>

      <section className="panel mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-3"><div className="flex-1"><h2 className="text-lg font-bold">Weekly holidays · साप्ताहिक बिदा</h2><p className="text-sm text-muted-foreground">Only Admin can change the weekly holiday settings.</p></div>{!isAdmin && <span className="chip">View only</span>}</div>
        <WeeklyOff readOnly={!isAdmin} />
      </section>

      <section className="panel mb-4">
        <h2 className="mb-1 text-lg font-bold">Campus academic calendar · शैक्षिक पात्रो</h2>
        <p className="mb-3 text-sm text-muted-foreground">Add academic events, holidays and important dates. The institutional name on reports comes from Institutional Profile above.</p>
        <Collection k="cal" title="Academic calendar" readOnly={!isAdmin} fields={[{ k: "type", l: "Type", t: "sel", opts: CAL_TYPES }, { k: "title", l: "Title / note" }, { k: "from", l: "From", t: "date" }, { k: "to", l: "To (blank for one day)", t: "date" }]} defaults={{ to: "" }}
          summary={(e) => <><b>{e.type}</b> {e.title && `— ${e.title}`}<div className="text-xs text-muted-foreground"><Dt d={e.from} />{e.to && e.to !== e.from && <> → <Dt d={e.to} /></>}</div></>} />
      </section>
          </Page>
  );
}

function ClassSetup({ canManage, departmentScope }: { canManage: boolean; departmentScope: string }) {
  const { data } = useTeacher();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", departmentId: departmentScope, subject: "", code: "", totalLh: 0 });
  const [bulk, setBulk] = useState<Record<string, string>>({});
  const [studentEdit, setStudentEdit] = useState<{ id: string; name: string; roll: string } | null>(null);
  const [studentMove, setStudentMove] = useState<{ id: string; toClassId: string } | null>(null);
  const [note, setNote] = useState("");
  const institutionName = data.settings.institution?.name || "Institution not yet named";
  const classes = [...data.classes].sort((a, b) => a.name.localeCompare(b.name));
  const resetDraft = () => setDraft({ name: "", departmentId: departmentScope, subject: "", code: "", totalLh: 0 });

  const addClass = () => {
    if (!draft.name.trim()) return setNote("कक्षाको नाम अनिवार्य छ। उदाहरण: BBS I, BBS II, MBS Semester I.");
    if (!draft.subject.trim()) return setNote("विषयको नाम पनि राख्नुहोस्।");
    updateData((d) => {
      d.classes.push({ id: uid(), name: draft.name.trim(), departmentId: draft.departmentId, subject: draft.subject.trim(), code: draft.code.trim(), totalLh: Number(draft.totalLh) || 0, year: currentYear(d)?.name ?? "", students: "", pending: false, closed: false });
    });
    resetDraft(); setFormOpen(false); setNote("कक्षा थपियो। अब यहीँ विद्यार्थी थप्न सक्नुहुन्छ।");
  };
  const startEdit = (cl: Cls) => {
    setEditing(cl.id); setFormOpen(false);
    setDraft({ name: cl.name, departmentId: cl.departmentId ?? "", subject: cl.subject, code: cl.code ?? "", totalLh: cl.totalLh ?? 0 });
  };
  const saveClass = () => {
    if (!editing || !draft.name.trim() || !draft.subject.trim()) return setNote("कक्षा र विषयको नाम आवश्यक छ।");
    updateData((d) => { const x = d.classes.find((z) => z.id === editing); if (x) Object.assign(x, { name: draft.name.trim(), departmentId: draft.departmentId, subject: draft.subject.trim(), code: draft.code.trim(), totalLh: Number(draft.totalLh) || 0 }); });
    setEditing(null); resetDraft(); setNote("कक्षाको विवरण अद्यावधिक भयो।");
  };
  const addClassStudents = (clsId: string) => {
    const names = (bulk[clsId] ?? "").split(/\r?\n/);
    let result = { added: [] as string[], skipped: [] as string[] };
    updateData((d) => { result = addStudents(d, clsId, names); });
    setBulk((b) => ({ ...b, [clsId]: "" }));
    setNote(`${result.added.length} विद्यार्थी थपिए${result.skipped.length ? `. पहिल्यै रहेका नाम छुटाइयो: ${result.skipped.join(", ")}` : ""}.`);
  };
  const saveStudent = () => {
    if (!studentEdit) return;
    let error: string | null = null;
    updateData((d) => {
      error = renameStudent(d, studentEdit.id, studentEdit.name);
      if (!error) setRoll(d, studentEdit.id, Number(studentEdit.roll));
    });
    if (error) setNote(error); else { setStudentEdit(null); setNote("विद्यार्थीको विवरण अद्यावधिक भयो।"); }
  };
  const saveStudentMove = () => {
    if (!studentMove?.toClassId) return setNote("पहिले नयाँ कक्षा छनोट गर्नुहोस्।");
    let result = { moved: [] as string[], conflicts: [] as string[] };
    updateData((d) => { result = moveStudents(d, [studentMove.id], studentMove.toClassId); });
    setStudentMove(null);
    setNote(result.moved.length ? `${result.moved.join(", ")} नयाँ कक्षामा सारियो। पुरानो कक्षाको इतिहास सुरक्षित छ.` : `विद्यार्थी सार्न सकिएन${result.conflicts.length ? `: ${result.conflicts.join(", ")}` : "."}`);
  };
  const runStudentStatus = (id: string, active: boolean, name: string) => {
    const msg = active ? `Restore ${name} to this class?` : `Archive ${name}? Historical attendance and marks will be retained.`;
    if (!confirm(msg)) return;
    updateData((d) => setActive(d, id, active));
  };

  const editor = (
    <section className="mb-4 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
      <h3 className="mb-3 font-semibold">{editing ? "Edit class · कक्षा सच्याउनुहोस्" : "New class · नयाँ कक्षा"}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label><span className="lbl">Class name</span><input className="field" placeholder="BBS I / BBS II / MBS Semester I" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label><span className="lbl">Department</span><select className="field" value={draft.departmentId} onChange={(e) => setDraft({ ...draft, departmentId: e.target.value })}><option value="">— Choose department —</option>{data.departments.filter((d) => d.active !== false && (!departmentScope || d.id === departmentScope)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{departmentScope && <span className="mt-1 block text-xs text-muted-foreground">Your assigned department is fixed by Admin.</span>}</label>
        <label><span className="lbl">Assigned subject</span><input className="field" placeholder="e.g. Financial Accounting" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
        <label><span className="lbl">Subject code</span><input className="field" placeholder="e.g. MGT 202" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></label>
        <label><span className="lbl">Total lecture hours (LH)</span><input className="field" type="number" min="0" value={draft.totalLh} onChange={(e) => setDraft({ ...draft, totalLh: Number(e.target.value) })} /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><button className="btn" onClick={editing ? saveClass : addClass}>{editing ? "Save class" : "Add class"}</button><button className="btn-soft" onClick={() => { setEditing(null); setFormOpen(false); resetDraft(); }}>Cancel</button></div>
    </section>
  );

  return (
    <section className="panel mb-4">
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <div className="flex-1"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{institutionName}</p><h2 className="text-xl font-bold">Classes & Students · कक्षा तथा विद्यार्थी</h2><p className="mt-1 text-sm text-muted-foreground">कार्यक्रम (Program) छुट्टै राखिएको छैन। कक्षा नाम सिधै थप्नुहोस्—जस्तै BBS I, BBS II, B.Ed, MBS। कक्षाभित्रै विद्यार्थी थप्ने, सच्याउने वा अभिलेख राखेर निष्क्रिय बनाउने सुविधा छ।</p></div>
        {canManage && !formOpen && !editing && <button className="btn" onClick={() => { setFormOpen(true); resetDraft(); }}>+ Add class</button>}
        {!canManage && <span className="chip">View only</span>}
      </div>
      {formOpen && canManage && editor}
      {editing && canManage && editor}
      {note && <p className="mb-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">{note}</p>}
      <div className="space-y-3">
        {classes.map((cl) => {
          const dept = data.departments.find((d) => d.id === cl.departmentId)?.name ?? "Department not assigned";
          const students = classStudents(data, cl.id, false);
          const activeCount = students.filter((s) => s.active).length;
          const isExpanded = expanded === cl.id;
          const canManageThis = canManage && (!departmentScope || cl.departmentId === departmentScope);
          return <article key={cl.id} className={`overflow-hidden rounded-xl border ${cl.closed ? "border-dashed border-border opacity-80" : "border-border"}`}>
            <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">{cl.name.slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><h3 className="font-bold">{cl.name}{cl.closed && <span className="chip ml-2">Archived</span>}</h3><p className="text-sm text-muted-foreground">{cl.subject}{cl.code ? ` · ${cl.code}` : ""} · {dept}</p><p className="text-xs text-muted-foreground">{activeCount} active / {students.length} total students · {cl.totalLh || 0} LH {cl.year ? `· ${cl.year}` : ""}</p></div>
              {canManageThis && !cl.closed && <button className="btn-soft" onClick={() => startEdit(cl)}>Edit class</button>}
              <button className="btn-soft" onClick={() => setExpanded(isExpanded ? null : cl.id)} aria-expanded={isExpanded}>{isExpanded ? "Hide students" : "Manage students"}</button>
            </div>
            {isExpanded && <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
              {canManageThis && !cl.closed && <div className="mb-4"><label className="lbl">Add multiple students — one name per line</label><textarea className="field min-h-20" placeholder="Student name 1\nStudent name 2\nStudent name 3" value={bulk[cl.id] ?? ""} onChange={(e) => setBulk((b) => ({ ...b, [cl.id]: e.target.value }))} /><button className="btn mt-2" disabled={!(bulk[cl.id] ?? "").trim()} onClick={() => addClassStudents(cl.id)}>+ Add students</button></div>}
              <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-2">Roll</th><th className="p-2">Student</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead><tbody>
                {students.map((st) => <tr key={st.id} className={`border-b border-border last:border-0 ${st.active ? "" : "opacity-60"}`}>
                  <td className="p-2">{studentEdit?.id === st.id ? <input className="field !w-20" type="number" min="1" value={studentEdit.roll} onChange={(e) => setStudentEdit({ ...studentEdit, roll: e.target.value })} /> : st.roll}</td>
                  <td className="p-2">{studentEdit?.id === st.id ? <input className="field min-w-44" value={studentEdit.name} onChange={(e) => setStudentEdit({ ...studentEdit, name: e.target.value })} /> : <span className="font-medium">{st.name}</span>}{st.history.length > 0 && <div className="text-[10px] text-muted-foreground">Previous class history retained</div>}</td>
                  <td className="p-2"><span className={st.active ? "chip" : "chip !border-destructive !text-destructive"}>{st.active ? "Active" : "Archived"}</span></td>
                  <td className="p-2"><div className="flex flex-wrap items-center gap-1">{canManageThis && studentEdit?.id === st.id ? <><button className="btn-soft !min-h-8" onClick={saveStudent}>Save</button><button className="btn-soft !min-h-8" onClick={() => setStudentEdit(null)}>Cancel</button></> : canManageThis && studentMove?.id === st.id ? <><select aria-label={`Move ${st.name} to class`} className="field !min-h-8 !w-44" value={studentMove.toClassId} onChange={(e) => setStudentMove({ ...studentMove, toClassId: e.target.value })}><option value="">Choose next class</option>{data.classes.filter((x) => x.id !== cl.id && !x.closed && (!departmentScope || x.departmentId === departmentScope)).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.subject}</option>)}</select><button className="btn-soft !min-h-8" disabled={!studentMove.toClassId} onClick={saveStudentMove}>Move</button><button className="btn-soft !min-h-8" onClick={() => setStudentMove(null)}>Cancel</button></> : canManageThis ? <><button className="btn-soft !min-h-8" onClick={() => { setStudentMove(null); setStudentEdit({ id: st.id, name: st.name, roll: String(st.roll) }); }}>Edit</button><button className="btn-soft !min-h-8" disabled={!st.active || !data.classes.some((x) => x.id !== cl.id && !x.closed && (!departmentScope || x.departmentId === departmentScope))} onClick={() => { setStudentEdit(null); setStudentMove({ id: st.id, toClassId: "" }); }}>Promote / Move</button><button className={st.active ? "btn-danger !min-h-8" : "btn-soft !min-h-8"} onClick={() => runStudentStatus(st.id, !st.active, st.name)}>{st.active ? "Remove / Archive" : "Restore"}</button></> : <span className="text-xs text-muted-foreground">Read only</span>}</div></td>
                </tr>)}
                {!students.length && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No students yet. Add them here when class setup is complete.</td></tr>}
              </tbody></table></div>
              <p className="mt-2 text-xs text-muted-foreground">Remove / Archive ले विद्यार्थीको पुरानो हाजिरी र मूल्याङ्कन मेटाउँदैन; केवल सक्रिय सूचीबाट हटाउँछ।</p>
            </div>}
          </article>;
        })}
        {!classes.length && <div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="font-semibold">No classes configured</p><p className="mt-1 text-sm text-muted-foreground">Start by adding the first class and assigned subject.</p>{canManage && <button className="btn mt-3" onClick={() => setFormOpen(true)}>+ Add first class</button>}</div>}
      </div>
    </section>
  );
}

const DAYS: [string, string][] = [["Sun", "Sunday · आइतबार"], ["Mon", "Monday · सोमबार"], ["Tue", "Tuesday · मंगलबार"], ["Wed", "Wednesday · बुधबार"], ["Thu", "Thursday · बिहीबार"], ["Fri", "Friday · शुक्रबार"], ["Sat", "Saturday · शनिबार"]];
function WeeklyOff({ readOnly }: { readOnly: boolean }) {
  const { data } = useTeacher();
  const off = weeklyOffOf(data);
  const toggle = (d: string) => updateData((x) => { const cur = weeklyOffOf(x); x.settings = { ...x.settings, weeklyOff: cur.includes(d) ? cur.filter((y) => y !== d) : [...cur, d] }; });
  return <div className="flex flex-wrap gap-2">{DAYS.map(([k, l]) => <label key={k} className={`${off.includes(k) ? "chip-on" : "chip"} ${readOnly ? "opacity-70" : "cursor-pointer"}`}><input type="checkbox" className="mr-1.5" disabled={readOnly} checked={off.includes(k)} onChange={() => toggle(k)} />{l}</label>)}</div>;
}
