import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Page, Tabs } from "@/components/app/ui";
import { ReportForm } from "@/components/sqc/ReportForm";
import { ReportList } from "@/components/sqc/ReportList";
import { SqcSetup, type StudentUser } from "@/components/sqc/SqcSetup";
import { Summary } from "@/components/sqc/Summary";
import { isStaff, useCloud } from "@/lib/cloud";
import { adminListUsers, type AdminUser, type Result } from "@/lib/admin.functions";
import {
  syncClasses,
  loadSubjects,
  loadActions,
  loadAllMembers,
  loadClasses,
  loadMemberships,
  loadPeriods,
  loadReports,
  loadTeachers,
  type ClassTeaching,
  type Membership,
  type Teacher,
} from "@/lib/sqc-data";
import type { Action, Period, Report, SqcClass } from "@/lib/sqc";

export const Route = createFileRoute("/sqc")({
  head: () => ({
    meta: [
      { title: "SQC — Student Quality Control" },
      {
        name: "description",
        content: "Class representatives report teacher attendance and teaching-learning issues; administrators respond and track them.",
      },
      { property: "og:title", content: "SQC — Student Quality Control" },
      { property: "og:description", content: "Class reports, administrator responses, summaries and printable reports." },
    ],
  }),
  component: Sqc,
});

type T = "new" | "list" | "summary" | "setup";
type Data = {
  classes: SqcClass[];
  periods: Period[];
  reports: Report[];
  actions: Action[];
  teachers: Teacher[];
  mine: Membership[];
  members: Membership[];
  students: StudentUser[];
  teaching: ClassTeaching[];
};
const EMPTY: Data = {
  classes: [],
  periods: [],
  reports: [],
  actions: [],
  teachers: [],
  mine: [],
  members: [],
  students: [],
  teaching: [],
};

// Module-level cache for instant rendering when revisiting SQC
let cachedSqcData: Data | null = null;
let lastSyncTime = 0;

function Sqc() {
  const c = useCloud();
  const admin = c.roles.includes("admin");
  const staff = isStaff(c.roles);
  const [d, setD] = useState<Data>(() => cachedSqcData ?? EMPTY);
  const [state, setState] = useState<"loading" | "ok" | "error">(() => (cachedSqcData ? "ok" : "loading"));
  const [error, setError] = useState("");
  const [tab, setTab] = useState<T>("list");
  const [editing, setEditing] = useState<Report | null>(null);
  const [setupLoaded, setSetupLoaded] = useState(false);

  const isRep = d.mine.some((m) => m.is_rep);
  const formClasses = admin
    ? d.classes
    : d.classes.filter((x) => d.mine.some((m) => m.class_id === x.id && m.is_rep));

  const load = useCallback(async () => {
    if (!c.userId) return;

    // 1. Fetch all primary SQC tables in a SINGLE parallel roundtrip (without blocking on syncClasses first!)
    const [cl, pe, re, ac, me, tRes, sjRes] = await Promise.all([
      loadClasses(),
      loadPeriods(),
      loadReports(),
      loadActions(),
      loadMemberships(c.userId),
      loadTeachers(),
      loadSubjects(),
    ]);

    const bad = [cl, pe, re, ac, me].find((x) => !x.ok);
    if (bad && !bad.ok) {
      setError(bad.error);
      setState("error");
      return;
    }

    const nextData: Data = {
      classes: cl.ok ? cl.data : [],
      periods: pe.ok ? pe.data : [],
      reports: re.ok ? re.data : [],
      actions: ac.ok ? ac.data : [],
      mine: me.ok ? me.data : [],
      teachers: tRes.ok ? tRes.data : [],
      teaching: sjRes.ok ? sjRes.data : [],
      members: cachedSqcData?.members ?? [],
      students: cachedSqcData?.students ?? [],
    };

    cachedSqcData = nextData;
    setD(nextData);
    setError("");
    setState("ok");

    // 2. Run syncClasses in background at most once every 2 minutes so it never slows down opening SQC
    const now = Date.now();
    if (now - lastSyncTime > 120_000) {
      lastSyncTime = now;
      void syncClasses().then(async (syncRes) => {
        if (syncRes.ok && syncRes.data > 0) {
          const freshCl = await loadClasses();
          if (freshCl.ok) {
            setD((prev) => {
              const updated = { ...prev, classes: freshCl.data };
              cachedSqcData = updated;
              return updated;
            });
          }
        }
      });
    }
  }, [c.userId]);

  // 3. Lazy-load heavy admin Setup data (all memberships + auth user list) only when Admin opens the Setup tab
  useEffect(() => {
    if (!admin || tab !== "setup" || setupLoaded) return;
    setSetupLoaded(true);
    void Promise.all([
      loadAllMembers(),
      (adminListUsers as any)({ data: {} }).catch(() => ({ ok: false })) as Promise<Result<{ users: AdminUser[] }>>,
    ]).then(([mRes, uRes]) => {
      setD((prev) => {
        const updated = {
          ...prev,
          members: mRes.ok ? mRes.data : prev.members,
          students:
            uRes && uRes.ok
              ? uRes.users
                  .filter((x) => x.roles.includes("student"))
                  .map((x) => ({ id: x.id, name: x.name, login: x.login }))
              : prev.students,
        };
        cachedSqcData = updated;
        return updated;
      });
    });
  }, [admin, tab, setupLoaded]);

  useEffect(() => {
    if (c.status === "ready") void load();
  }, [c.status, load]);

  useEffect(() => {
    setTab(admin ? "list" : isRep ? "new" : "list");
  }, [admin, isRep]);

  if (c.status !== "ready") return null;
  const tabs: [T, string][] = [];
  if (admin || isRep) tabs.push(["new", "New report · नयाँ"]);
  tabs.push(["list", "Reports · प्रतिवेदन"], ["summary", "Summary · सारांश"]);
  if (admin) tabs.push(["setup", "Setup · सेटअप"]);

  return (
    <Page
      title="SQC · विद्यार्थी गुणस्तर नियन्त्रण"
      sub="Student Quality Control — class reports on teaching and learning, with administrator response and follow-up."
    >
      {state === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
      {state === "error" && (
        <p className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>
      )}
      {state === "ok" && (
        <>
          {!admin && !staff && !isRep && (
            <p className="panel text-sm">
              You are not a class representative, so you cannot submit or view SQC reports. Please contact the administrator.
            </p>
          )}
          {(admin || staff || isRep) && (
            <>
              <Tabs
                value={tab}
                onChange={(t) => {
                  setTab(t);
                  setEditing(null);
                }}
                items={tabs}
              />
              {tab === "new" &&
                (editing ? (
                  <ReportForm
                    teaching={d.teaching}
                    key={editing.id}
                    classes={formClasses}
                    teachers={d.teachers}
                    periods={d.periods}
                    initial={editing}
                    onSaved={() => {
                      setEditing(null);
                      setTab("list");
                      void load();
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : formClasses.length === 0 ? (
                  <p className="panel text-sm">No class is assigned to you yet. Ask the administrator.</p>
                ) : (
                  <ReportForm
                    teaching={d.teaching}
                    classes={formClasses}
                    teachers={d.teachers}
                    periods={d.periods}
                    onSaved={() => {
                      setTab("list");
                      void load();
                    }}
                  />
                ))}
              {tab === "list" &&
                (editing ? (
                  <ReportForm
                    teaching={d.teaching}
                    key={editing.id}
                    classes={formClasses}
                    teachers={d.teachers}
                    periods={d.periods}
                    initial={editing}
                    onSaved={() => {
                      setEditing(null);
                      void load();
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <ReportList
                    rows={d.reports}
                    classes={d.classes}
                    periods={d.periods}
                    actions={d.actions}
                    admin={admin}
                    canEdit={admin || isRep}
                    onEdit={setEditing}
                    onChanged={() => {
                      setSetupLoaded(false);
                      void load();
                    }}
                  />
                ))}
              {tab === "summary" && <Summary rows={d.reports} periods={d.periods} classes={d.classes} />}
              {tab === "setup" && admin && (
                <SqcSetup
                  classes={d.classes}
                  periods={d.periods}
                  members={d.members}
                  students={d.students}
                  onChanged={() => {
                    setSetupLoaded(false);
                    void load();
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}
