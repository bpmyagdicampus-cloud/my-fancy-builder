import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Page, Tabs } from "@/components/app/ui";
import { ActivitiesTab } from "@/components/dm/ActivitiesTab";
import { BudgetTab } from "@/components/dm/BudgetTab";
import { PlansTab } from "@/components/dm/PlansTab";
import { ReportsTab } from "@/components/dm/ReportsTab";
import { useCloud } from "@/lib/cloud";
import * as C from "@/lib/campus";
import * as D from "@/lib/dm";
import { useTeacher } from "@/lib/store";
import { currentYear } from "@/lib/years";

export const Route = createFileRoute("/department")({
  head: () => ({
    meta: [
      { title: "Department Management — Shikshak Diary" },
      { name: "description", content: "Department plans, budget, activities, monitoring and reports." },
      { property: "og:title", content: "Department Management — Shikshak Diary" },
      { property: "og:description", content: "Department plans, budget, activities, monitoring and reports." },
    ],
  }),
  component: Department,
});

type DeptTab = "overview" | "plans" | "activities" | "budget" | "reports";

const MODULES: { key: DeptTab; ne: string; en: string; note: string; headOnly?: boolean }[] = [
  { key: "plans", ne: "वार्षिक योजना", en: "Annual plans", note: "उद्देश्य, लक्ष्य, सूचक, अनुमानित बजेट र स्वीकृति प्रक्रिया" },
  { key: "activities", ne: "गतिविधि तथा प्रगति", en: "Activities and progress", note: "जिम्मेवार व्यक्ति, प्रगति प्रतिशत (%), उपलब्धि र प्रमाण अपलोड" },
  { key: "budget", ne: "बजेट व्यवस्थापन र खर्च", en: "Budget & expenses", note: "प्रस्तावित/स्वीकृत बजेट, बजेट संशोधन र भौचर सहितको खर्च अभिलेख", headOnly: true },
  { key: "reports", ne: "स्वचालित प्रतिवेदन", en: "Automated reports", note: "मासिक, वार्षिक वा मितिअनुसार प्रिन्ट तथा Word/Excel प्रतिवेदन" },
];

const money = (n: number | undefined) => `रु. ${Number(n || 0).toLocaleString("en-IN")}`;

function Department() {
  const cl = useCloud();
  const lk = C.useLookup();
  const { data: diary } = useTeacher();
  const [years, setYears] = useState<D.AcademicYear[]>([]);
  const [yearErr, setYearErr] = useState("");
  const [year, setYear] = useState("");
  const [dept, setDept] = useState("");
  const [ov, setOv] = useState<D.Overview | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<DeptTab>("overview");
  const [tick, setTick] = useState(0);

  const admin = cl.roles.includes("admin");
  const staff = admin || cl.roles.includes("teacher");
  const mine = lk.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);
  const myDeptName = (cl.me?.dept ?? "").trim().toLowerCase();
  // administrator: every department; head: own departments; teacher: the department named in the profile
  const options = lk.departments.filter(
    (d) => admin || mine.includes(d.id) || (myDeptName && d.name.trim().toLowerCase() === myDeptName)
  );
  const canManage = !!dept && (admin || mine.includes(dept));

  useEffect(() => {
    if (cl.status !== "ready") return;
    void D.loadYears().then((r) => {
      if (!r.ok) {
        setYearErr(r.error);
        return;
      }
      setYears(r.data);
    });
  }, [cl.status]);

  // year names: the administrator's list, plus the years already used in the diary (so the module works before the list is filled)
  const yearNames = useMemo(() => {
    const set = new Set<string>([...years.map((y) => y.name), ...diary.years.map((y) => y.name)]);
    return [...set].filter(Boolean);
  }, [years, diary.years]);

  const activeName = years.find((y) => y.is_active)?.name ?? currentYear(diary)?.name ?? "";

  useEffect(() => {
    if (!year && yearNames.length) {
      setYear(activeName && yearNames.includes(activeName) ? activeName : yearNames[yearNames.length - 1]!);
    }
  }, [yearNames, activeName, year]);

  useEffect(() => {
    if (!dept && options[0]) setDept(options[0].id);
  }, [options, dept]);

  useEffect(() => {
    if (!canManage && tab === "budget") setTab("overview");
  }, [canManage, tab]);

  useEffect(() => {
    if (!dept || !year) {
      setOv(null);
      return;
    }
    setErr("");
    void D.loadOverview(dept, year, canManage).then((r) => {
      if (r.ok) setOv(r.data);
      else {
        setOv(null);
        setErr(r.error);
      }
    });
  }, [dept, year, canManage, tick]);

  if (cl.status !== "ready" || !cl.userId) {
    return (
      <Page title="Department Management · विभागीय व्यवस्थापन">
        <p className="text-sm text-muted-foreground">Please sign in.</p>
      </Page>
    );
  }
  if (!staff) {
    return (
      <Page title="Department Management · विभागीय व्यवस्थापन">
        <p className="text-sm text-muted-foreground">
          This module is for teachers, department heads and the administration.
        </p>
      </Page>
    );
  }

  const dname = lk.departments.find((d) => d.id === dept)?.name ?? "";
  const num = (n: number | undefined) => n ?? 0;

  const tabItems: [DeptTab, string][] = [
    ["overview", "Overview · सारांश"],
    ["plans", "Annual plans · वार्षिक योजना"],
    ["activities", "Activities · गतिविधि तथा प्रगति"],
    ...(canManage ? ([["budget", "Budget & expenses · बजेट तथा खर्च"]] as [DeptTab, string][]) : []),
    ["reports", "Reports · प्रतिवेदन"],
  ];

  return (
    <Page
      title="Department Management · विभागीय व्यवस्थापन"
      sub="विभागीय योजना, बजेट, गतिविधि, अनुगमन र स्वचालित प्रतिवेदन"
    >
      <div className="no-print mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="lbl">Department · विभाग</label>
          <select className="field" value={dept} onChange={(e) => setDept(e.target.value)}>
            {!options.length && <option value="">{lk.ready ? "No department for you yet" : "Loading…"}</option>}
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Academic year · शैक्षिक वर्ष</label>
          <select className="field" value={year} onChange={(e) => setYear(e.target.value)}>
            {!yearNames.length && <option value="">No academic year yet</option>}
            {yearNames.map((n) => (
              <option key={n} value={n}>
                {n}
                {n === activeName ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <span className="chip">{admin ? "Administration" : canManage ? "Department head" : "Teacher · view & progress"}</span>
        </div>
      </div>

      {!years.length && !yearErr && (
        <p className="no-print mb-3 text-xs text-muted-foreground">
          The administrator has not added academic years in Admin yet, so the years used in your diary are shown.
        </p>
      )}
      {yearErr && <p className="no-print mb-3 rounded-md border border-border p-2 text-sm text-muted-foreground">{yearErr}</p>}
      {err && <p className="no-print mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}

      <Tabs value={tab} onChange={setTab} items={tabItems} />

      {tab === "plans" && (
        <PlansTab dept={dept} year={year} admin={admin} canManage={canManage} onChanged={() => setTick((x) => x + 1)} />
      )}

      {tab === "activities" && (
        <ActivitiesTab
          dept={dept}
          deptName={dname}
          year={year}
          userId={cl.userId}
          canManage={canManage}
          onChanged={() => setTick((x) => x + 1)}
        />
      )}

      {tab === "budget" && (
        <BudgetTab dept={dept} year={year} admin={admin} canManage={canManage} onChanged={() => setTick((x) => x + 1)} />
      )}

      {tab === "reports" && <ReportsTab dept={dept} deptName={dname} year={year} canManage={canManage} />}

      {tab === "overview" && (
        <>
          <section className="panel mb-4">
            <h2 className="mb-1 text-lg font-bold">
              {dname || "—"} · {year || "—"}
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              सबै संख्या यो विभाग र शैक्षिक वर्षको सुरक्षित रेकर्डबाट गणना गरिएको हो।
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Annual plans · वार्षिक योजना", num(ov?.plans)],
                ["Activities · गतिविधिहरू", num(ov?.activities)],
                ["Completed · सम्पन्न गतिविधि", num(ov?.activitiesByStatus.completed)],
                ["Average progress · औसत प्रगति", `${num(ov?.avgProgress)}%`],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-md border border-border p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{v}</div>
                  <div className="text-xs text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>

            {canManage && ov && (
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
                <div className="rounded-md border border-border p-2.5 text-center">
                  <div className="text-base font-bold text-primary">{money(ov.budgetProposed)}</div>
                  <div className="text-xs text-muted-foreground">Proposed · प्रस्तावित बजेट</div>
                </div>
                <div className="rounded-md border border-border p-2.5 text-center">
                  <div className="text-base font-bold text-primary">{money(ov.budgetApproved)}</div>
                  <div className="text-xs text-muted-foreground">Approved · स्वीकृत बजेट</div>
                </div>
                <div className="rounded-md border border-border p-2.5 text-center">
                  <div className="text-base font-bold text-primary">{money(ov.budgetSpent)}</div>
                  <div className="text-xs text-muted-foreground">Spent · कुल खर्च</div>
                </div>
                <div className="rounded-md border border-border p-2.5 text-center">
                  <div className={`text-base font-bold ${ov.budgetRemaining < 0 ? "text-destructive" : "text-primary"}`}>
                    {money(ov.budgetRemaining)}
                  </div>
                  <div className="text-xs text-muted-foreground">Remaining · बाँकी बजेट</div>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {D.ACT_STATUS.map((s) => (
                <span key={s.k} className="chip">
                  {s.en} · {s.ne}: {num(ov?.activitiesByStatus[s.k])}
                </span>
              ))}
              {canManage && num(ov?.pendingRevisions) > 0 && (
                <span className="chip-on">Pending budget revisions · बजेट संशोधन माग: {num(ov?.pendingRevisions)}</span>
              )}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            {MODULES.filter((m) => !m.headOnly || canManage).map((m) => (
              <section key={m.key} className="panel">
                <div className="flex items-center gap-2">
                  <h3 className="flex-1 text-base font-bold">{m.ne}</h3>
                  <span className="chip-on text-xs">Active</span>
                </div>
                <div className="text-sm font-medium">{m.en}</div>
                <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>
                <button className="btn-soft mt-3" onClick={() => setTab(m.key)}>
                  Open · खोल्नुहोस्
                </button>
              </section>
            ))}
          </div>
        </>
      )}

      <p className="no-print mt-4 text-xs text-muted-foreground">
        यो विभागीय अनुगमन औजार हो, क्याम्पसको आधिकारिक लेखा प्रणाली होइन। · This is departmental tracking, not the campus's
        official accounting system.
      </p>
    </Page>
  );
}
