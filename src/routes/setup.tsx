import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page, FormFields, Collection, Dt, NeedProfile } from "@/components/app/ui";
import { mutate, updateData, useTeacher, studentsOf } from "@/lib/store";
import { weeklyOffOf } from "@/lib/migrate";
import { CAL_TYPES } from "@/lib/constants";
import { PROFILE_FIELDS } from "./profiles";
import { useCloud } from "@/lib/cloud";
import { CampusSetup } from "@/components/app/CampusSetup";
import { DeptTag } from "@/components/app/ClassFields";
import * as C from "@/lib/campus";
import { classDataSummary } from "@/lib/classes";

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
  const [f, setF] = useState<Record<string, any>>({});
  useEffect(() => { if (profile) setF(profile); }, [profile?.id]);
  if (!profile) return <NeedProfile />;
  return (
    <Page title="Setup" sub="Campus, departments, classes, students, teacher details and the academic calendar">
      <CampusSetup />
      <section className="panel mb-4">
        <h2 className="mb-3 text-lg font-bold">Teacher details</h2>
        <FormFields fields={PROFILE_FIELDS} value={f} onChange={setF} />
        <button className="btn mt-3" onClick={() => mutate((x) => { const i = x.profiles.findIndex((p) => p.id === profile.id); x.profiles[i] = { ...x.profiles[i]!, ...f, id: profile.id }; })}>Save</button>
      </section>
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

/** The original Classes list, now grouped by department (Management by default) with a department on every class. */
function ClassesByDept() {
  const { data } = useTeacher();
  const cl = useCloud();
  const lk = C.useLookup();
  const [dept, setDept] = useState("all");
  const [msg, setMsg] = useState("");
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
    updateData((d) => { for (const c of d.classes) { const x = lk.classes.find((k) => k.id === c.centralId); if (x && x.name !== c.name) c.name = x.name; } });
  }, [lk.classes, lk.ready, lk.failed, data.classes]);

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
      <Collection k="classes" title="Classes · कक्षा" sort={(a, b) => a.name.localeCompare(b.name)} rowButtons
        rowExtra={(c) => <button type="button" className="btn-soft" title="A disabled class keeps all its data but is hidden from new entries" onClick={(e) => { e.stopPropagation(); updateData((d) => { const x = d.classes.find((k) => k.id === c.id); if (x) x.closed = !c.closed; }); }}>{c.closed ? "Enable" : "Disable"}</button>}
        canDelete={(c) => { const hits = classDataSummary(data, c.id); return hits.length ? `“${c.name} · ${c.subject}” cannot be deleted because it already has data: ${hits.join(", ")}.\n\nA class with data is kept so nothing is lost. Use Academic years → Upgrade subject to close it instead.` : null; }}
        filter={(c) => dept === "all" || deptOf(c) === dept}
        defaults={{ deptId: dept !== "all" ? dept : mg }}
        fields={[
          { k: "deptId", l: "Department · विभाग", t: "dept" },
          { k: "name", l: "Class · कक्षा (e.g. BBS I)", t: "cpick" },
          { k: "subject", l: "Subject" },
          { k: "code", l: "Subject code (e.g. Acc 211)" },
          { k: "totalLh", l: "Total lecture hours (LH)", t: "num" },
        ]}
        summary={(c) => <><DeptTag deptId={c.deptId} /><b>{c.name}</b> · {c.subject} {c.code && `(${c.code})`}<div className="text-xs text-muted-foreground">{c.totalLh} LH · {studentsOf(c).length} students{c.closed && <span className="chip ml-2">disabled / closed</span>}{c.pending && <span className="chip ml-2">subject not upgraded yet</span>}{!c.centralId && <span className="chip ml-2">not linked to a department class yet</span>}</div></>} />
    </>
  );
}
