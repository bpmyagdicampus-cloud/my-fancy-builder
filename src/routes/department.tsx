import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/components/app/ui";
import { useCloud } from "@/lib/cloud";
import * as C from "@/lib/campus";
import * as D from "@/lib/dm";

export const Route = createFileRoute("/department")({
  head: () => ({ meta: [
    { title: "Department Management — Shikshak Diary" },
    { name: "description", content: "Department plans, budget, activities, monitoring and reports." },
    { property: "og:title", content: "Department Management — Shikshak Diary" },
    { property: "og:description", content: "Department plans, budget, activities, monitoring and reports." },
  ] }),
  component: Department,
});

const MODULES: { ne: string; en: string; note: string; stage: number }[] = [
  { ne: "वार्षिक योजना", en: "Annual plans", note: "उद्देश्य, लक्ष्य, गतिविधि र समयसीमा", stage: 2 },
  { ne: "गतिविधि तथा प्रगति", en: "Activities and progress", note: "जिम्मेवार व्यक्ति, उपलब्धि र प्रमाण", stage: 3 },
  { ne: "बजेट व्यवस्थापन", en: "Budget management", note: "प्रस्तावित, स्वीकृत, खर्च र बाँकी रकम", stage: 4 },
  { ne: "स्वचालित प्रतिवेदन", en: "Automated reports", note: "मासिक, वार्षिक वा मितिअनुसार", stage: 6 },
];

function Department() {
  const cl = useCloud();
  const lk = C.useLookup();
  const [years, setYears] = useState<D.AcademicYear[]>([]);
  const [yearErr, setYearErr] = useState("");
  const [year, setYear] = useState("");
  const [dept, setDept] = useState("");
  const [ov, setOv] = useState<D.Overview | null>(null);
  const [err, setErr] = useState("");

  const admin = cl.roles.includes("admin");
  const staff = admin || cl.roles.includes("teacher");
  const mine = lk.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);
  const myDeptName = (cl.me?.dept ?? "").trim().toLowerCase();
  // administrator: every department; head: own departments; teacher: the department named in the profile
  const options = lk.departments.filter((d) => admin || mine.includes(d.id) || (myDeptName && d.name.trim().toLowerCase() === myDeptName));
  const canManage = !!dept && (admin || mine.includes(dept));

  useEffect(() => {
    if (cl.status !== "ready") return;
    void D.loadYears().then((r) => {
      if (!r.ok) { setYearErr(r.error); return; }
      setYears(r.data);
      setYear((cur) => cur || r.data.find((y) => y.is_active)?.name || r.data[r.data.length - 1]?.name || "");
    });
  }, [cl.status]);
  useEffect(() => { if (!dept && options[0]) setDept(options[0].id); }, [options, dept]);
  useEffect(() => {
    if (!dept || !year) { setOv(null); return; }
    setErr("");
    void D.loadOverview(dept, year).then((r) => { if (r.ok) setOv(r.data); else { setOv(null); setErr(r.error); } });
  }, [dept, year]);

  if (cl.status !== "ready" || !cl.userId) return <Page title="Department Management · विभागीय व्यवस्थापन"><p className="text-sm text-muted-foreground">Please sign in.</p></Page>;
  if (!staff) return <Page title="Department Management · विभागीय व्यवस्थापन"><p className="text-sm text-muted-foreground">This module is for teachers, department heads and the administration.</p></Page>;

  const dname = lk.departments.find((d) => d.id === dept)?.name ?? "";
  const num = (n: number | undefined) => n ?? 0;

  return (
    <Page title="Department Management · विभागीय व्यवस्थापन" sub="विभागीय योजना, बजेट, गतिविधि, अनुगमन र प्रतिवेदन">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div><label className="lbl">Department · विभाग</label>
          <select className="field" value={dept} onChange={(e) => setDept(e.target.value)}>
            {!options.length && <option value="">{lk.ready ? "No department for you yet" : "Loading…"}</option>}
            {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div><label className="lbl">Academic year · शैक्षिक वर्ष</label>
          <select className="field" value={year} onChange={(e) => setYear(e.target.value)}>
            {!years.length && <option value="">{yearErr ? "—" : "No academic year yet"}</option>}
            {years.map((y) => <option key={y.id} value={y.name}>{y.name}{y.is_active ? " (active)" : ""}</option>)}
          </select></div>
        <div className="flex items-end"><span className="chip">{admin ? "Administration" : canManage ? "Department head" : "Teacher · view"}</span></div>
      </div>

      {yearErr && <p className="mb-3 rounded-md border border-border p-2 text-sm text-muted-foreground">{yearErr}</p>}
      {err && <p className="mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">{err}</p>}

      <section className="panel mb-4">
        <h2 className="mb-1 text-lg font-bold">{dname || "—"} · {year || "—"}</h2>
        <p className="mb-3 text-xs text-muted-foreground">सबै संख्या यो विभाग र वर्षको सुरक्षित रेकर्डबाट गणना गरिएको हो।</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Annual plans", num(ov?.plans)],
            ["Activities", num(ov?.activities)],
            ["Completed", num(ov?.activitiesByStatus.completed)],
            ["Average progress", `${num(ov?.avgProgress)}%`],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-md border border-border p-3 text-center"><div className="text-2xl font-bold text-primary">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {D.ACT_STATUS.map((s) => <span key={s.k} className="chip">{s.en} · {s.ne}: {num(ov?.activitiesByStatus[s.k])}</span>)}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODULES.map((m) => (
          <section key={m.en} className="panel opacity-80">
            <div className="flex items-center gap-2"><h3 className="flex-1 text-base font-bold">{m.ne}</h3><span className="chip">Stage {m.stage}</span></div>
            <div className="text-sm font-medium">{m.en}</div>
            <p className="text-sm text-muted-foreground">{m.note}</p>
            <p className="mt-2 text-xs text-muted-foreground">अर्को चरणमा थपिने।</p>
          </section>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">यो विभागीय अनुगमन औजार हो, क्याम्पसको आधिकारिक लेखा प्रणाली होइन। · This is departmental tracking, not the campus's official accounting system.</p>
    </Page>
  );
}
