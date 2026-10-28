import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Page, FormFields, Collection, Dt, NeedProfile, type Field } from "@/components/app/ui";
import { mutate, updateData, uid, useTeacher, studentsOf, type Cls } from "@/lib/store";
import { weeklyOffOf } from "@/lib/migrate";
import { CAL_TYPES } from "@/lib/constants";
import { PROFILE_FIELDS } from "./profiles";
import { useCloud } from "@/lib/cloud";
import { CampusSetup } from "@/components/app/CampusSetup";
import { DeptTag } from "@/components/app/ClassFields";
import * as C from "@/lib/campus";
import { classDataSummary } from "@/lib/classes";
import { addStudents, classStudents } from "@/lib/students";
import {
  listPeerClassStudents,
  setupListTeachers,
  setupUpdateTeacher,
  type PeerStudentSource,
  type Result,
  type SetupTeacher,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [
    { title: "Setup — Shikshak Diary" },
    { name: "description", content: "Campus, teacher, classes, students and academic calendar setup." },
    { property: "og:title", content: "Setup — Shikshak Diary" },
    { property: "og:description", content: "Campus, teacher, classes, students and academic calendar setup." },
  ] }),
  component: Setup,
});

function Setup() {
  const { profile } = useTeacher();
  const cloud = useCloud();
  const canEdit = cloud.status !== "ready" || cloud.roles.includes("admin");
  if (!profile) return <NeedProfile />;
  return (
    <Page title="Setup" sub="Campus, departments, classes, students, teacher details and the academic calendar">
      <CampusSetup />
      <TeacherDetailsSection />
      <WeeklyOff canEdit={canEdit} />
      <section className="panel no-print mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Upgrade Students · विद्यार्थी अपग्रेड</h2>
          <p className="text-sm text-muted-foreground">Add students, move one student, or move a whole class to another class. The Active setting stays as it is. Academic years and subject upgrades are in <Link to="/years" className="underline">Academic years</Link>.</p>
        </div>
        <Link to="/students" className="btn">Upgrade Students</Link>
      </section>
      <ClassesByDept />
      <Collection k="cal" title="Campus academic calendar"
        fields={[{ k: "type", l: "Type", t: "sel", opts: CAL_TYPES }, { k: "title", l: "Title / note" }, { k: "from", l: "From", t: "date" }, { k: "to", l: "To (blank for one day)", t: "date" }]}
        defaults={{ to: "" }}
        summary={(e) => <><b>{e.type}</b> {e.title && `— ${e.title}`}<div className="text-xs text-muted-foreground"><Dt d={e.from} />{e.to && e.to !== e.from && <> → <Dt d={e.to} /></>}</div></>} />
    </Page>
  );
}

/**
 * Requirement 3: Teacher details kept compact on the outside with a "View" button.
 * Inside View:
 * - Admin sees all teachers
 * - Department Head sees teachers of their own department(s) only
 * - Teacher sees only their own details
 * Each row has an "Edit" button on the side to edit according to role.
 */
function TeacherDetailsSection() {
  const { profile, profiles } = useTeacher();
  const cl = useCloud();
  const lk = C.useLookup();
  const [open, setOpen] = useState(false);
  const [teachers, setTeachers] = useState<SetupTeacher[]>([]);
  const [scope, setScope] = useState<"admin" | "head" | "teacher">("teacher");
  const [headDepts, setHeadDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<SetupTeacher | null>(null);

  const signedIn = cl.status === "ready" && !!cl.userId;
  const isAdmin = signedIn ? cl.roles.includes("admin") : true;
  const myHeadDeptIds = lk.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);
  const myHeadDeptNames = lk.departments.filter((d) => myHeadDeptIds.includes(d.id)).map((d) => d.name);

  const loadTeachers = useCallback(async () => {
    if (!profile) return;
    if (!signedIn) {
      setScope("admin");
      setTeachers(profiles.map((p) => ({ ...p, canEdit: true })));
      return;
    }
    setLoading(true);
    try {
      const r = (await (setupListTeachers as any)({ data: {} })) as Result<{
        teachers: SetupTeacher[];
        scope: "admin" | "head" | "teacher";
        headDepts: string[];
      }>;
      if (r.ok && r.teachers.length > 0) {
        setTeachers(r.teachers);
        setScope(r.scope);
        setHeadDepts(r.headDepts);
        setLoading(false);
        return;
      }
    } catch {
      /* fallback below */
    }
    // Fallback if offline or server function unavailable
    const fallbackScope: "admin" | "head" | "teacher" = cl.roles.includes("admin")
      ? "admin"
      : myHeadDeptIds.length > 0
      ? "head"
      : "teacher";
    setScope(fallbackScope);
    setHeadDepts(myHeadDeptNames);
    setTeachers([
      {
        id: profile.id,
        name: profile.name,
        designation: profile.designation,
        dept: profile.dept,
        campus: profile.campus,
        address: profile.address,
        hod: profile.hod,
        chief: profile.chief,
        canEdit: true,
      },
    ]);
    setLoading(false);
  }, [profile, profiles, signedIn, cl.roles, myHeadDeptIds.join(","), myHeadDeptNames.join(",")]);

  useEffect(() => {
    if (open) void loadTeachers();
  }, [open, loadTeachers]);

  const saveTeacher = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setNote("Please enter the teacher's name · शिक्षकको नाम लेख्नुहोस्।");
      return;
    }
    setNote("");
    if (signedIn) {
      try {
        const r = (await (setupUpdateTeacher as any)({ data: editing })) as Result;
        if (!r.ok) {
          // If editing own profile and server function failed, still update own profile locally & via cloud sync
          if (editing.id !== profile?.id) {
            setNote(r.error);
            return;
          }
        }
      } catch (e) {
        if (editing.id !== profile?.id) {
          setNote(e instanceof Error ? e.message : String(e));
          return;
        }
      }
    }
    // Also update local store if this profile exists locally (triggers cloud sync for own profile)
    mutate((x) => {
      const i = x.profiles.findIndex((p) => p.id === editing.id);
      if (i >= 0) {
        const { canEdit: _, ...clean } = editing;
        x.profiles[i] = { ...x.profiles[i]!, ...clean, id: editing.id };
      }
    });
    setNote(`Saved details for ${editing.name} · विवरण सुरक्षित भयो।`);
    setEditing(null);
    await loadTeachers();
  };

  const roleHint = isAdmin
    ? "Admin: सबै शिक्षकहरूको विवरण हेर्न र सम्पादन गर्न सकिने"
    : myHeadDeptIds.length > 0
    ? `Department Head (${myHeadDeptNames.join(", ")}): आफ्नो विभागका शिक्षकहरूको विवरण हेर्न र सम्पादन गर्न सकिने`
    : "Teacher: आफ्नो व्यक्तिगत विवरण हेर्न र सम्पादन गर्न सकिने";

  return (
    <section className="panel no-print mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Teacher details · शिक्षक विवरण</h2>
          <p className="text-xs text-muted-foreground">
            {profile?.name}
            {profile?.designation ? ` · ${profile.designation}` : ""}
            {profile?.dept ? ` · ${profile.dept}` : ""} — {roleHint}
          </p>
        </div>
        <button
          type="button"
          className={open ? "btn-soft" : "btn"}
          onClick={() => {
            setOpen((v) => !v);
            setEditing(null);
            setNote("");
          }}
        >
          {open ? "Hide · बन्द गर्नुहोस्" : "View · हेर्नुहोस्"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="chip text-xs">
              {scope === "admin"
                ? `All teachers · सबै शिक्षकहरू (${teachers.length})`
                : scope === "head"
                ? `Department teachers · विभागका शिक्षकहरू (${headDepts.join(", ") || profile?.dept}) (${teachers.length})`
                : "My details · मेरो विवरण"}
            </span>
          </div>

          {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
          {loading && <p className="text-sm text-muted-foreground">Loading teacher details…</p>}

          {editing && (
            <div className="mb-4 rounded-lg border border-primary/40 bg-secondary/40 p-3">
              <h3 className="mb-2 text-base font-bold">Edit teacher details · विवरण सम्पादन ({editing.name})</h3>
              <FormFields fields={PROFILE_FIELDS} value={editing} onChange={(v) => setEditing({ ...editing, ...v })} />
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn" onClick={() => void saveTeacher()}>
                  Save · सुरक्षित गर्नुहोस्
                </button>
                <button type="button" className="btn-soft" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border">
            {teachers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {t.name || "—"}
                    {t.id === profile?.id && <span className="chip ml-2 text-xs">You · म</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      t.designation && `पद: ${t.designation}`,
                      t.dept && `विभाग: ${t.dept}`,
                      t.campus && `क्याम्पस: ${t.campus}`,
                      t.address && `ठेगाना: ${t.address}`,
                      t.hod && `विभागीय प्रमुख: ${t.hod}`,
                      t.chief && `क्याम्पस प्रमुख: ${t.chief}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No extra details filled yet."}
                  </div>
                </div>
                {t.canEdit && (
                  <button
                    type="button"
                    className="btn-soft shrink-0"
                    onClick={() => {
                      setEditing({ ...t });
                      setNote("");
                    }}
                  >
                    Edit · सम्पादन
                  </button>
                )}
              </div>
            ))}
            {!loading && !teachers.length && (
              <p className="py-2 text-sm text-muted-foreground">No teacher records found.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const DAYS: [string, string][] = [["Sun", "Sunday · आइतबार"], ["Mon", "Monday · सोमबार"], ["Tue", "Tuesday · मंगलबार"], ["Wed", "Wednesday · बुधबार"], ["Thu", "Thursday · बिहीबार"], ["Fri", "Friday · शुक्रबार"], ["Sat", "Saturday · शनिबार"]];

function WeeklyOff({ canEdit }: { canEdit: boolean }) {
  const { data } = useTeacher();
  const off = weeklyOffOf(data);
  const toggle = (d: string) => canEdit && updateData((x) => {
    const cur = weeklyOffOf(x);
    x.settings = { ...x.settings, weeklyOff: cur.includes(d) ? cur.filter((y) => y !== d) : [...cur, d] };
  });
  return (
    <section className="panel no-print mb-4">
      <h2 className="mb-1 text-lg font-bold">Weekly holidays · साप्ताहिक बिदा</h2>
      <p className="mb-3 text-xs text-muted-foreground">Selected days are shaded as holidays in the monthly report and warned about when saving a diary entry. {canEdit ? "" : "Only the administrator can change these."}</p>
      <div className="flex flex-wrap gap-2">
        {DAYS.map(([k, l]) => (
          <label key={k} className={off.includes(k) ? "chip-on cursor-pointer" : "chip cursor-pointer"}>
            <input type="checkbox" className="mr-1.5" checked={off.includes(k)} disabled={!canEdit} onChange={() => toggle(k)} />{l}
          </label>
        ))}
      </div>
    </section>
  );
}

const CLASS_FIELDS: Field[] = [
  { k: "deptId", l: "Department · विभाग", t: "dept" },
  { k: "name", l: "Class · कक्षा (e.g. BBS I)", t: "cpick" },
  { k: "subject", l: "Subject · विषय" },
  { k: "code", l: "Subject code (e.g. Acc 211)" },
  { k: "totalLh", l: "Total lecture hours (LH)", t: "num" },
];

/** Three-dot menu for each class row (Edit, Disable/Enable, Delete). */
function ClassRowDots({ items }: { items: [string, () => void, boolean?][] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <summary className="btn-soft cursor-pointer list-none !px-2.5" aria-label="More options" title="More actions">
        ⋮
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-border bg-card p-1 shadow-lg">
        {items.map(([label, fn, danger]) => (
          <button
            key={label}
            type="button"
            className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted ${danger ? "text-destructive" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (ref.current) ref.current.open = false;
              fn();
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

/**
 * Requirement 2:
 * - On each class row, ONLY the "Students" button is directly visible beside the row;
 *   "Edit", "Disable / Enable", and "Delete" are placed inside the ⋮ (three-dot) menu.
 * - When creating/editing a class/subject in Setup (or clicking Students), if other subjects of the same class
 *   already have students, the teacher can preview them and pull them right into this subject.
 */
function ClassesByDept() {
  const { profile, data } = useTeacher();
  const cl = useCloud();
  const lk = C.useLookup();
  const nav = useNavigate();
  const [dept, setDept] = useState("all");
  const [msg, setMsg] = useState("");
  const [ed, setEd] = useState<Record<string, any> | null>(null);

  // Peer student sources for the class currently being created/edited
  const [peerSources, setPeerSources] = useState<PeerStudentSource[]>([]);
  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const mg = C.findManagement(lk.departments)?.id ?? "";
  const deptOf = (c: { deptId?: string | undefined }) => c.deptId || mg;
  const mine = lk.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);
  const canIn = (id: string) => cl.roles.includes("admin") || mine.includes(id);
  const unlinked = data.classes.filter((c) => !c.closed && !c.centralId);
  const count = (id: string) => data.classes.filter((c) => deptOf(c) === id).length;

  // a class renamed in the department list is renamed here too (names follow the central class)
  useEffect(() => {
    if (!lk.ready || lk.failed) return;
    const stale = data.classes.some((c) => c.centralId && lk.classes.some((x) => x.id === c.centralId && x.name !== c.name));
    if (!stale) return;
    updateData((d) => { for (const c of d.classes) { const x = lk.classes.find((k) => k.id === c.centralId); if (x && x.name !== c.name) c.name = x.name; } }, true);
  }, [lk.classes, lk.ready, lk.failed, data.classes]);

  // Load peer subjects' students whenever a class is selected in the Add/Edit form
  const edCentralId = String(ed?.centralId ?? "").trim();
  const edClassName = String(ed?.name ?? "").trim();
  const edId = String(ed?.id ?? "").trim();

  useEffect(() => {
    if (!ed || (!edCentralId && !edClassName)) {
      setPeerSources([]);
      setSelectedSourceKey("");
      setPreviewOpen(false);
      return;
    }
    // 1. Local classes of the same class name or centralId
    const localMatches: PeerStudentSource[] = data.classes
      .filter((c) => {
        if (c.closed || (edId && c.id === edId)) return false;
        const mCentral = edCentralId && c.centralId && c.centralId === edCentralId;
        const mName = edClassName && c.name.trim().toLowerCase() === edClassName.toLowerCase();
        return mCentral || mName;
      })
      .map((c) => {
        const stu = classStudents(data, c.id, true).map((s) => ({ name: s.name, roll: s.roll }));
        return {
          key: `local:${c.id}`,
          teacherId: profile?.id ?? "me",
          teacherName: `${profile?.name ?? "My class"} (मेरो अर्को विषय)`,
          classId: c.id,
          className: c.name,
          subject: c.subject || "Subject",
          code: c.code || "",
          students: stu,
        };
      })
      .filter((s) => s.students.length > 0);

    setPeerSources(localMatches);
    if (localMatches[0]) setSelectedSourceKey((prev) => prev || localMatches[0]!.key);

    // 2. Cloud peer classes across all teachers
    if (cl.status === "ready" && cl.userId) {
      let active = true;
      void (listPeerClassStudents as any)({
        data: { centralId: edCentralId, className: edClassName, excludeClassId: edId },
      })
        .then((r: Result<{ sources: PeerStudentSource[] }>) => {
          if (!active || !r?.ok) return;
          const merged = [...localMatches];
          const seenClassIds = new Set(localMatches.map((x) => x.classId));
          for (const s of r.sources) {
            if (!seenClassIds.has(s.classId)) {
              seenClassIds.add(s.classId);
              merged.push(s);
            }
          }
          setPeerSources(merged);
          if (merged[0]) setSelectedSourceKey((prev) => (merged.some((m) => m.key === prev) ? prev : merged[0]!.key));
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [edCentralId, edClassName, edId, Boolean(ed), data.classes, data.students, cl.status, cl.userId, profile?.id, profile?.name]);

  const linkAll = async () => {
    setMsg("");
    let made = 0, linked = 0;
    let classes = [...lk.classes];
    const map: Record<string, { deptId: string; centralId: string }> = {};
    for (const c of unlinked) {
      const dId = deptOf(c);
      if (!dId) continue;
      const find = () => classes.find((x) => x.department_id === dId && x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
      let hit = find();
      if (!hit && canIn(dId) && c.name.trim()) {
        const r = await C.addClass(dId, c.name);
        if (r.ok) { made++; const rr = await C.refreshLookup(); if (rr.ok) { classes = rr.data.classes; hit = find(); } } else setMsg(r.error);
      }
      if (hit) { map[c.id] = { deptId: dId, centralId: hit.id }; linked++; }
    }
    updateData((d) => { for (const c of d.classes) { const m = map[c.id]; if (m) { c.deptId = m.deptId; c.centralId = m.centralId; } } });
    setMsg(`${linked} classes linked${made ? `, ${made} new classes added to the department` : ""}.${unlinked.length - linked ? ` ${unlinked.length - linked} could not be linked (ask the administrator or department head).` : ""}`);
  };

  const selectedSource = peerSources.find((s) => s.key === selectedSourceKey) ?? null;

  const saveClass = (pullFromSource = false) => {
    if (!ed) return;
    if (!String(ed.name ?? "").trim()) {
      alert("Please choose or enter a class name · कक्षा छान्नुहोस्।");
      return;
    }
    const targetId = ed.id || uid();
    const srcToCopy = pullFromSource ? selectedSource : null;
    updateData((d) => {
      const i = d.classes.findIndex((x) => x.id === ed.id);
      const row: Cls = {
        id: targetId,
        name: String(ed.name ?? "").trim(),
        subject: String(ed.subject ?? "").trim(),
        code: String(ed.code ?? "").trim(),
        year: String(ed.year ?? ""),
        totalLh: Number(ed.totalLh) || 0,
        students: String(ed.students ?? ""),
        deptId: ed.deptId || mg,
        centralId: ed.centralId || "",
        closed: Boolean(ed.closed),
        pending: Boolean(ed.pending),
      };
      if (i >= 0) d.classes[i] = row;
      else d.classes.push(row);

      if (srcToCopy && srcToCopy.students.length > 0) {
        addStudents(
          d,
          targetId,
          srcToCopy.students.map((s) => s.name)
        );
      }
    });
    if (srcToCopy && srcToCopy.students.length > 0) {
      setMsg(`Saved "${ed.name} · ${ed.subject}" and pulled ${srcToCopy.students.length} students from ${srcToCopy.subject}.`);
    }
    setEd(null);
  };

  const deleteClassRow = (c: Cls) => {
    const hits = classDataSummary(data, c.id);
    if (hits.length) {
      alert(`“${c.name} · ${c.subject}” cannot be deleted because it already has data: ${hits.join(", ")}.\n\nA class with data is kept so nothing is lost. Use Academic years → Upgrade subject to close it instead.`);
      return;
    }
    if (confirm(`Do you want to permanently delete “${c.name} · ${c.subject}”?`)) {
      updateData((d) => {
        const idx = d.classes.findIndex((x) => x.id === c.id);
        if (idx >= 0) d.classes.splice(idx, 1);
      });
      if (ed?.id === c.id) setEd(null);
    }
  };

  const list = data.classes
    .filter((c) => dept === "all" || deptOf(c) === dept)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {lk.departments.length > 0 && (
        <section className="panel no-print mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Department · विभाग:</span>
            <button className={dept === "all" ? "chip-on" : "chip"} onClick={() => setDept("all")}>All ({data.classes.length})</button>
            {lk.departments.map((d) => <button key={d.id} className={dept === d.id ? "chip-on" : "chip"} onClick={() => setDept(d.id)}>{d.name} ({count(d.id)})</button>)}
          </div>
          {unlinked.length > 0 && (
            <div className="mt-2 text-sm">
              <button className="btn-soft" onClick={() => void linkAll()}>Link {unlinked.length} existing classes to their department</button>
              <span className="ml-2 text-xs text-muted-foreground">Classes without a department are treated as Management. Linking makes them available to SQC.</span>
            </div>
          )}
          {msg && <p className="mt-2 rounded-md border border-primary p-2 text-sm">{msg}</p>}
        </section>
      )}

      <section className="panel no-print mb-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-bold">
            Classes · कक्षा <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
          </h2>
          {!ed && (
            <button
              className="btn"
              onClick={() =>
                setEd({
                  deptId: dept !== "all" ? dept : mg,
                  name: "",
                  centralId: "",
                  subject: "",
                  code: "",
                  totalLh: 0,
                  students: "",
                })
              }
            >
              + Add
            </button>
          )}
        </div>

        {ed && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-secondary/40 p-3">
            <FormFields fields={CLASS_FIELDS} value={ed} onChange={setEd} />

            {/* Pull students from another subject of the same class right while creating/editing */}
            {peerSources.length > 0 && (
              <div className="mt-3 rounded-md border border-primary/30 bg-card p-3">
                <div className="text-xs font-bold text-primary">
                  यही कक्षा ({ed.name}) को अन्य विषयमा विद्यार्थीहरू उपलब्ध छन् · Students found in other subjects of {ed.name}
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  अर्को विषय छान्नुहोस्, विद्यार्थी नामावली हेर्नुहोस् र सिधै यो विषयमा तान्नुहोस्:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="field !w-auto min-w-60"
                    value={selectedSourceKey}
                    onChange={(e) => setSelectedSourceKey(e.target.value)}
                  >
                    {peerSources.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.className} · {s.subject} ({s.teacherName}) — {s.students.length} students
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-soft text-xs"
                    onClick={() => setPreviewOpen((v) => !v)}
                  >
                    {previewOpen ? "Hide list · लुकाउनुहोस्" : `View ${selectedSource?.students.length ?? 0} students · हेर्नुहोस्`}
                  </button>
                  <button
                    type="button"
                    className="btn text-xs"
                    onClick={() => saveClass(true)}
                  >
                    Save & Pull {selectedSource?.students.length ?? 0} students · सेभ र विद्यार्थी तान्नुहोस्
                  </button>
                </div>
                {previewOpen && selectedSource && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border bg-secondary/20 p-2 text-xs">
                    <div className="mb-1 font-semibold">
                      {selectedSource.className} · {selectedSource.subject} ({selectedSource.teacherName}) का विद्यार्थीहरू:
                    </div>
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                      {selectedSource.students.map((st, idx) => (
                        <div key={idx} className="truncate">
                          <b>{st.roll}.</b> {st.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn" onClick={() => saveClass(false)}>
                Save
              </button>
              <button className="btn-soft" onClick={() => setEd(null)}>
                Cancel
              </button>
              {ed.id && (
                <button
                  className="btn-danger ml-auto"
                  onClick={() => {
                    const row = data.classes.find((x) => x.id === ed.id);
                    if (row) deleteClassRow(row);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        <ul className="divide-y divide-border">
          {list.map((c) => (
            <li
              key={c.id}
              className="cursor-pointer py-2.5 text-sm hover:bg-muted/50"
              onClick={() => setEd(structuredClone(c))}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <DeptTag deptId={c.deptId} />
                  <b>{c.name}</b> · {c.subject} {c.code && `(${c.code})`}
                  <div className="text-xs text-muted-foreground">
                    {c.totalLh} LH · {studentsOf(c).length} students
                    {c.closed && <span className="chip ml-2">disabled / closed</span>}
                    {c.pending && <span className="chip ml-2">subject not upgraded yet</span>}
                    {!c.centralId && <span className="chip ml-2">not linked to a department class yet</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-soft"
                    title="Add, pull from other subjects, edit or move students of this class"
                    onClick={() => {
                      try {
                        sessionStorage.setItem("shikshak-students-cls", c.id);
                      } catch {
                        /* ignore */
                      }
                      void nav({ to: "/students" });
                    }}
                  >
                    Students
                  </button>
                  <ClassRowDots
                    items={[
                      ["Edit · सम्पादन", () => setEd(structuredClone(c))],
                      [
                        c.closed ? "Enable · सक्रिय बनाउने" : "Disable · निष्क्रिय बनाउने",
                        () =>
                          updateData((d) => {
                            const x = d.classes.find((k) => k.id === c.id);
                            if (x) x.closed = !c.closed;
                          }),
                      ],
                      ["Delete · हटाउने", () => deleteClassRow(c), true],
                    ]}
                  />
                </div>
              </div>
            </li>
          ))}
          {!list.length && <li className="py-2 text-sm text-muted-foreground">No entries yet.</li>}
        </ul>
      </section>
    </>
  );
}
