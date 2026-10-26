import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Page, Tabs } from "@/components/app/ui";
import { ReportForm } from "@/components/sqc/ReportForm";
import { ReportList } from "@/components/sqc/ReportList";
import { SqcSetup, type StudentUser } from "@/components/sqc/SqcSetup";
import { Summary } from "@/components/sqc/Summary";
import { isStaff, useCloud } from "@/lib/cloud";
import { adminListUsers, type AdminUser, type Result } from "@/lib/admin.functions";
import { syncClasses, loadSubjects, loadActions, loadAllMembers, loadClasses, loadMemberships, loadPeriods, loadReports, loadTeachers, type ClassTeaching, type Membership, type Teacher } from "@/lib/sqc-data";
import type { Action, Period, Report, SqcClass } from "@/lib/sqc";

export const Route = createFileRoute("/sqc")({
  head: () => ({ meta: [
    { title: "SQC — Student Quality Control" },
    { name: "description", content: "Class representatives report teacher attendance and teaching-learning issues; administrators respond and track them." },
    { property: "og:title", content: "SQC — Student Quality Control" },
    { property: "og:description", content: "Class reports, administrator responses, summaries and printable reports." },
  ] }),
  component: Sqc,
});

type T = "new" | "list" | "summary" | "setup";
type Data = { classes: SqcClass[]; periods: Period[]; reports: Report[]; actions: Action[]; teachers: Teacher[]; mine: Membership[]; members: Membership[]; students: StudentUser[]; teaching: ClassTeaching[] };
const EMPTY: Data = { classes: [], periods: [], reports: [], actions: [], teachers: [], mine: [], members: [], students: [], teaching: [] };

function Sqc() {
  const c = useCloud();
  const admin = c.roles.includes("admin");
  const staff = isStaff(c.roles);
  const [d, setD] = useState<Data>(EMPTY);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<T>("list");
  const [editing, setEditing] = useState<Report | null>(null);

  const isRep = d.mine.some((m) => m.is_rep);
  const formClasses = admin ? d.classes : d.classes.filter((x) => d.mine.some((m) => m.class_id === x.id && m.is_rep));

  const load = useCallback(async () => {
    if (!c.userId) return;
    await syncClasses(); // best effort: classes come from Setup
    const [cl, pe, re, ac, me] = await Promise.all([loadClasses(), loadPeriods(), loadReports(), loadActions(), loadMemberships(c.userId)]);
    const bad = [cl, pe, re, ac, me].find((x) => !x.ok);
    if (bad && !bad.ok) { setError(bad.error); setState("error"); return; }
    const mine = me.ok ? me.data : [];
    let teachers: Teacher[] = [], members: Membership[] = [], students: StudentUser[] = [], teaching: ClassTeaching[] = [];
    if (admin || mine.some((m) => m.is_rep)) {
      const [t, sj] = await Promise.all([loadTeachers(), loadSubjects()]);
      if (t.ok) teachers = t.data;
      if (sj.ok) teaching = sj.data;
    }
    if (admin) {
      const m = await loadAllMembers(); if (m.ok) members = m.data;
      try {
        const u = (await (adminListUsers as any)({ data: {} })) as Result<{ users: AdminUser[] }>;
        if (u.ok) students = u.users.filter((x) => x.roles.includes("student")).map((x) => ({ id: x.id, name: x.name, login: x.login }));
      } catch { /* student list stays empty */ }
    }
    setD({ classes: cl.ok ? cl.data : [], periods: pe.ok ? pe.data : [], reports: re.ok ? re.data : [], actions: ac.ok ? ac.data : [], teachers, mine, members, students, teaching });
    setError(""); setState("ok");
  }, [c.userId, admin]);

  useEffect(() => { if (c.status === "ready") void load(); }, [c.status, load]);
  useEffect(() => { setTab(admin ? "list" : isRep ? "new" : "list"); }, [admin, isRep]);

  if (c.status !== "ready") return null;
  const tabs: [T, string][] = [];
  if (admin || isRep) tabs.push(["new", "New report · नयाँ"]);
  tabs.push(["list", "Reports · प्रतिवेदन"], ["summary", "Summary · सारांश"]);
  if (admin) tabs.push(["setup", "Setup · सेटअप"]);

  return (
    <Page title="SQC · विद्यार्थी गुणस्तर नियन्त्रण" sub="Student Quality Control — class reports on teaching and learning, with administrator response and follow-up.">
      {state === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
      {state === "error" && <p className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
      {state === "ok" && (
        <>
          {!admin && !staff && !isRep && <p className="panel text-sm">You are not a class representative, so you cannot submit or view SQC reports. Please contact the administrator.</p>}
          {(admin || staff || isRep) && (
            <>
              <Tabs value={tab} onChange={(t) => { setTab(t); setEditing(null); }} items={tabs} />
              {tab === "new" && (editing
                ? <ReportForm teaching={d.teaching} key={editing.id} classes={formClasses} teachers={d.teachers} periods={d.periods} initial={editing} onSaved={() => { setEditing(null); setTab("list"); void load(); }} onCancel={() => setEditing(null)} />
                : formClasses.length === 0
                  ? <p className="panel text-sm">No class is assigned to you yet. Ask the administrator.</p>
                  : <ReportForm teaching={d.teaching} classes={formClasses} teachers={d.teachers} periods={d.periods} onSaved={() => { setTab("list"); void load(); }} />)}
              {tab === "list" && (editing
                ? <ReportForm teaching={d.teaching} key={editing.id} classes={formClasses} teachers={d.teachers} periods={d.periods} initial={editing} onSaved={() => { setEditing(null); void load(); }} onCancel={() => setEditing(null)} />
                : <ReportList rows={d.reports} classes={d.classes} periods={d.periods} actions={d.actions} admin={admin} canEdit={admin || isRep} onEdit={setEditing} onChanged={load} />)}
              {tab === "summary" && <Summary rows={d.reports} periods={d.periods} classes={d.classes} />}
              {tab === "setup" && admin && <SqcSetup classes={d.classes} periods={d.periods} members={d.members} students={d.students} onChanged={load} />}
            </>
          )}
        </>
      )}
    </Page>
  );
}
