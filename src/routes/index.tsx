import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTeacher, studentsOf } from "@/lib/store";
import { todayBs, fmtBs, inRange } from "@/lib/bs";
import { pct, totalLhDone } from "@/lib/progress";
import { ACT_CATS } from "@/lib/constants";
import { Dt } from "@/components/app/ui";
import { useCloud } from "@/lib/cloud";
import * as C from "@/lib/campus";
import * as D from "@/lib/dm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shikshak Diary — शिक्षक डायरी" },
      { name: "description", content: "Daily teaching diary, lesson plans, student attendance, assessments and printable monthly reports for teachers in Nepal." },
      { property: "og:title", content: "Shikshak Diary — शिक्षक डायरी" },
      { property: "og:description", content: "Daily teaching diary, lesson plans, attendance, assessments and monthly reports." },
    ],
  }),
  component: Home,
});

function Home() {
  const { profile, data } = useTeacher();
  const cl = useCloud();
  const lk = C.useLookup();
  const [actSum, setActSum] = useState<D.DmActionSummary | null>(null);
  const [campusEvents, setCampusEvents] = useState<D.CampusAnnualEvent[]>([]);
  const [calTypes, setCalTypes] = useState<D.CampusCalType[]>([]);
  const [calFilter, setCalFilter] = useState("");
  const [showAllYear, setShowAllYear] = useState(false);
  const today = todayBs();

  const admin = cl.roles.includes("admin");
  const headDepts = lk.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);

  useEffect(() => {
    void Promise.all([D.loadCampusAnnualEvents(), D.loadCalTypes()]).then(async ([evList, tList]) => {
      setCampusEvents(evList);
      setCalTypes(tList);

      if (admin && data?.cal && data.cal.length > 0) {
        const missing = data.cal.filter(
          (c) => !evList.some((ce) => ce.title === c.title && ce.from_date === c.from)
        );
        if (missing.length > 0) {
          const synced = await D.syncLocalEventsToCloud(missing);
          if (synced && synced.length > 0) {
            setCampusEvents((prev) => [...prev, ...synced]);
          }
        }
      }
    });
  }, [admin, data?.cal]);

  useEffect(() => {
    if (cl.status !== "ready" || !cl.userId) {
      setActSum(null);
      return;
    }
    void D.loadActionSummary(cl.userId, admin, headDepts).then(setActSum);
  }, [cl.status, cl.userId, admin, headDepts.join(",")]);

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="panel py-10">
          <img src="/icon-192.png" alt="शिक्षक डायरी" className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-sm" />
          <h1 className="font-display text-4xl text-primary sm:text-5xl">शिक्षक डायरी</h1>
          <p className="mt-1 text-sm font-semibold tracking-wide text-muted-foreground">
            Teacher's Diary · Academic Management System
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground sm:text-sm">
            दैनिक शिक्षण अभिलेख, पाठ योजना, विद्यार्थी हाजिरी, मूल्याङ्कन र मासिक प्रतिवेदन व्यवस्थापन प्रणाली।
          </p>
          <Link to="/profiles" className="btn mt-6">
            सुरु गर्नुहोस् — शिक्षक प्रोफाइल छान्नुहोस् →
          </Link>
          <p className="mt-6 text-xs text-muted-foreground">
            © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
          </p>
        </div>
      </main>
    );
  }

  // Combine Admin's Campus Annual Calendar events + local events
  const mergedAnnualEvents = [
    ...campusEvents.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.event_type,
      from: e.from_date,
      to: e.to_date || "",
      desc: e.description,
      isCloud: true,
    })),
    ...data.cal
      .filter((c) => !campusEvents.some((ce) => ce.title === c.title && ce.from_date === c.from))
      .map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        from: c.from,
        to: c.to || "",
        desc: "",
        isCloud: false,
      })),
  ].sort((a, b) => a.from.localeCompare(b.from));

  const upcomingAnnualEvents = mergedAnnualEvents.filter((e) => (e.to || e.from) >= today);
  const targetAnnualEvents =
    showAllYear || upcomingAnnualEvents.length === 0 ? mergedAnnualEvents : upcomingAnnualEvents;
  const filteredAnnualEvents = calFilter
    ? targetAnnualEvents.filter((e) => e.type === calFilter)
    : targetAnnualEvents;

  const todayEv = mergedAnnualEvents.filter((e) => inRange(today, e.from, e.to || e.from));

  const upcomingReminders = [
    ...data.reminders
      .filter((r) => r.date >= today && r.status !== "Done")
      .map((r) => ({ d: r.date, t: `${r.time ? r.time + " · " : ""}${r.title}`, k: "Reminder" })),
    ...data.plans
      .filter((p) => p.date >= today && p.status !== "Done")
      .map((p) => ({ d: p.date, t: `${p.type}: ${p.title}`, k: "Plan" })),
  ]
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(0, 8);

  const actCounts = ACT_CATS.map((c) => [c, data.acts.filter((a) => a.category === c).length] as const).filter(
    ([, n]) => n > 0
  );

  const hasAlerts =
    !!actSum &&
    (actSum.submittedPlans > 0 ||
      actSum.pendingBudgetLines > 0 ||
      actSum.pendingRevisions > 0 ||
      actSum.myAssignedActivities > 0 ||
      actSum.pendingSqcReports > 0);

  // KPI metrics
  const openClasses = data.classes.filter((c) => !c.closed);
  const totalStudentsCount = openClasses.reduce((sum, c) => sum + studentsOf(c).length, 0);
  const totalPlannedLh = openClasses.reduce((sum, c) => sum + (Number(c.totalLh) || 0), 0);
  const totalDoneLh = openClasses.reduce((sum, c) => sum + totalLhDone(data.diary, c.id), 0);
  const overallCoursePct = pct(totalDoneLh, totalPlannedLh);
  const todayDiaryEntries = data.diary.filter((d) => d.date === today);
  const todayLhCount = todayDiaryEntries.reduce((sum, d) => sum + (Number(d.lh) || 0), 0);

  return (
    <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-2.5 py-3 sm:px-5 sm:py-5">
      {/* Hero Banner: Large Campus Name + Campus Address underneath */}
      <section className="panel mb-4 overflow-hidden border-primary/20 bg-gradient-to-br from-secondary/80 to-card p-3.5 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold uppercase tracking-wide text-primary sm:text-3xl">
              {profile.campus || "MYAGDI MULTIPLE CAMPUS"}
            </h1>
            {profile.address && (
              <div className="mt-0.5 text-xs font-medium text-muted-foreground sm:text-sm">
                📍 {profile.address}
              </div>
            )}

            <div className="mt-2 border-t border-border/60 pt-2">
              <div className="text-base font-bold text-foreground sm:text-xl">{profile.name}</div>
              <div className="text-xs font-medium text-muted-foreground sm:text-sm">
                {profile.designation}
                {profile.dept && ` · ${profile.dept}`}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 font-semibold shadow-sm">
                📅 आज: <b className="text-primary">{fmtBs(today)}</b>
              </span>
              {todayEv.map((e) => (
                <span key={e.id} className="chip-on !py-0.5 !text-[11px]">
                  🎉 {e.title} ({e.type})
                </span>
              ))}
              {!todayEv.length && (
                <span className="text-[11px] text-muted-foreground">· आज विशेष बिदा छैन</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
            <Link to="/diary" className="btn col-span-2 !min-h-9 !px-3 !py-1.5 text-xs sm:col-span-1">
              + आजको दैनिक डायरी (Daily Diary)
            </Link>
            <Link to="/reports" className="btn-soft !min-h-9 !px-2.5 !py-1.5 text-xs">
              📊 मासिक प्रतिवेदन
            </Link>
            <Link to="/department" className="btn-soft !min-h-9 !px-2.5 !py-1.5 text-xs">
              🏛️ विभागीय व्यवस्थापन
            </Link>
            <Link to="/sqc" className="btn-soft col-span-2 !min-h-9 !px-2.5 !py-1.5 text-xs sm:col-span-1">
              🛡️ SQC
            </Link>
          </div>
        </div>
      </section>

      {/* Top KPI Cards + Course Progress Card with Per-Class Bar Chart */}
      <section className="mb-4 grid grid-cols-3 gap-2 lg:grid-cols-6">
        <Link to="/setup" className="kpi-card min-w-0 !p-2.5 sm:!p-3.5 lg:col-span-1">
          <div className="truncate text-[11px] font-semibold text-muted-foreground">सक्रिय कक्षा</div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-xl font-extrabold text-primary sm:text-2xl">{openClasses.length}</span>
            <span className="truncate rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
              {totalStudentsCount} विद्या.
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">सक्रिय विषयहरू</div>
        </Link>

        <Link to="/diary" className="kpi-card min-w-0 !p-2.5 sm:!p-3.5 lg:col-span-1">
          <div className="truncate text-[11px] font-semibold text-muted-foreground">आजको अध्यापन</div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-xl font-extrabold text-foreground sm:text-2xl">{todayDiaryEntries.length}</span>
            <span className="truncate rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
              {todayLhCount} LH
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
            कुल डायरी: <b>{data.diary.length}</b>
          </div>
        </Link>

        <div className="kpi-card min-w-0 !p-2.5 sm:!p-3.5 lg:col-span-1">
          <div className="truncate text-[11px] font-semibold text-muted-foreground">आगामी कार्य</div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-xl font-extrabold text-primary sm:text-2xl">{upcomingAnnualEvents.length}</span>
            <span className="truncate rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {upcomingReminders.length} रिमा.
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">पात्रो र कार्यसूची</div>
        </div>

        {/* Overall & Per-Class Course Progress Bar Chart Card */}
        <Link to="/reports" className="kpi-card col-span-3 min-w-0 !p-3 sm:!p-3.5 lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">
              📊 कुल कोर्स प्रगति · Course Progress
            </span>
            <span className="text-xs font-extrabold text-primary">
              {overallCoursePct}% <span className="font-normal text-muted-foreground">({totalDoneLh}/{totalPlannedLh} LH)</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overallCoursePct}%` }} />
          </div>

          {openClasses.length > 0 && (
            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/60 pt-2">
              {openClasses.map((c) => {
                const done = totalLhDone(data.diary, c.id);
                const p = pct(done, c.totalLh);
                return (
                  <div key={c.id} className="min-w-0">
                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <span className="truncate font-semibold text-foreground">
                        {c.name} <span className="font-normal text-muted-foreground">({c.code || c.subject})</span>
                      </span>
                      <span className="shrink-0 font-bold text-primary">{p}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(p, done > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Link>
      </section>

      {hasAlerts && actSum && (
        <section className="panel mb-4 border-primary/40 bg-primary/5 !p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-primary">
            <span>🔔</span>
            <span>ध्यानाकर्षण तथा जिम्मेवारीहरू · Action Notifications</span>
          </h2>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {admin && actSum.submittedPlans > 0 && (
              <Link to="/department" className="chip-on">
                स्वीकृतिको लागि पेस भएका वार्षिक योजना: {actSum.submittedPlans}
              </Link>
            )}
            {admin && actSum.pendingBudgetLines > 0 && (
              <Link to="/department" className="chip-on">
                स्वीकृतिको लागि पेस भएका बजेट शीर्षक: {actSum.pendingBudgetLines}
              </Link>
            )}
            {admin && actSum.pendingRevisions > 0 && (
              <Link to="/department" className="chip-on">
                बजेट संशोधन अनुरोध: {actSum.pendingRevisions}
              </Link>
            )}
            {admin && actSum.pendingSqcReports > 0 && (
              <Link to="/sqc" className="chip-on">
                सम्बोधन हुन बाँकी SQC रिपोर्ट: {actSum.pendingSqcReports}
              </Link>
            )}
            {!admin && headDepts.length > 0 && actSum.submittedPlans > 0 && (
              <Link to="/department" className="chip">
                मस्यौदा (Draft) वार्षिक योजना: {actSum.submittedPlans}
              </Link>
            )}
            {actSum.myAssignedActivities > 0 && (
              <Link to="/department" className="chip-on">
                मेरो जिम्मेवारीमा रहेका विभागीय गतिविधि: {actSum.myAssignedActivities}
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Campus Annual Calendar — 2 columns per row on mobile */}
      <section className="panel mb-4 !p-3 sm:!p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold sm:text-base">
              📅 Campus Annual Calendar · क्याम्पस वार्षिक क्यालेन्डर
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {mergedAnnualEvents.length > 0 && (
              <div className="inline-flex rounded-md border border-border bg-muted/50 p-0.5">
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                    !showAllYear && upcomingAnnualEvents.length > 0
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setShowAllYear(false)}
                >
                  आगामी ({upcomingAnnualEvents.length})
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                    showAllYear || upcomingAnnualEvents.length === 0
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setShowAllYear(true)}
                >
                  सबै ({mergedAnnualEvents.length})
                </button>
              </div>
            )}

            {calTypes.length > 0 && (
              <select
                className="field !min-h-7 !w-auto !px-2 !py-0.5 !text-[11px]"
                value={calFilter}
                onChange={(e) => setCalFilter(e.target.value)}
              >
                <option value="">सबै प्रकार ({targetAnnualEvents.length})</option>
                {calTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {admin && (
              <Link to="/setup" className="btn-soft !min-h-7 !px-2 !py-0.5 text-[11px]">
                Setup →
              </Link>
            )}
          </div>
        </div>

        {/* 2 columns per row on mobile (grid-cols-2), 3 on tablet, 4 on desktop */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredAnnualEvents.slice(0, 10).map((ev) => {
            const isToday = inRange(today, ev.from, ev.to || ev.from);
            const isHol = /holiday|बिदा|vacation/i.test(ev.type);
            return (
              <div
                key={ev.id}
                className={`min-w-0 overflow-hidden rounded-lg border p-2 text-[11px] transition-all ${
                  isToday
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isHol
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      isHol
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {ev.type}
                  </span>
                  {isToday && <span className="shrink-0 text-[10px] font-bold text-primary">आज</span>}
                </div>
                <div className="mt-1 truncate font-bold text-xs text-foreground" title={ev.title}>
                  {ev.title}
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  📅 {fmtBs(ev.from)}
                  {ev.to && ev.to !== ev.from && ` → ${fmtBs(ev.to)}`}
                </div>
              </div>
            );
          })}
        </div>

        {!filteredAnnualEvents.length && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {mergedAnnualEvents.length > 0 && !showAllYear ? (
              <p>
                आगामी मितिमा कुनै नयाँ कार्यक्रम छैन।{" "}
                <button
                  type="button"
                  className="ml-1 font-semibold text-primary underline"
                  onClick={() => setShowAllYear(true)}
                >
                  वर्षभरिका सबै ({mergedAnnualEvents.length}) कार्यक्रम हेर्नुहोस्
                </button>
              </p>
            ) : (
              <p>क्याम्पस वार्षिक क्यालेन्डरमा हाल कुनै कार्यक्रम भेटिएन।</p>
            )}
          </div>
        )}
      </section>

      {/* My Classes — Compact 2-Column Cards on Mobile (matching KPI card size) */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold sm:text-base">
          📚 My classes — course completion · मेरा कक्षा र कोर्स प्रगति
        </h2>
        <Link to="/setup" className="text-xs font-semibold text-primary hover:underline">
          + कक्षा व्यवस्थापन (Setup) →
        </Link>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {openClasses.map((c) => {
          const done = totalLhDone(data.diary, c.id);
          const p = pct(done, c.totalLh);
          const n = data.diary.filter((e) => e.classId === c.id).length;
          const stuCount = studentsOf(c).length;
          return (
            <div
              key={c.id}
              className="kpi-card flex min-w-0 flex-col justify-between overflow-hidden !p-2.5 sm:!p-3.5"
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-foreground sm:text-sm">{c.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground" title={c.subject}>
                      {c.subject} {c.code && `(${c.code})`}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {p}%
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(p, done > 0 ? 4 : 0)}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    <b>{done}</b>/{c.totalLh} LH
                  </span>
                  <span>{n} classes</span>
                  <span>{stuCount} stu</span>
                </div>
              </div>

              <div className="mt-2 flex gap-1 border-t border-border/60 pt-2">
                <Link to="/diary" className="btn-soft !min-h-7 flex-1 !px-1.5 !py-0.5 text-[10px]">
                  + डायरी
                </Link>
                <Link to="/plans" className="btn-soft !min-h-7 flex-1 !px-1.5 !py-0.5 text-[10px]">
                  योजना
                </Link>
              </div>
            </div>
          );
        })}
        {!openClasses.length && (
          <div className="panel col-span-full py-6 text-center text-xs text-muted-foreground">
            अहिलेसम्म कुनै कक्षा थपिएको छैन।{" "}
            <Link to="/setup" className="font-semibold text-primary underline">
              Setup बाट कक्षा र विषय थप्नुहोस् →
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="panel !p-3 sm:!p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">⏰ Upcoming reminders & plans · आगामी कार्यहरू</h2>
            <Link to="/records" className="text-xs font-semibold text-primary hover:underline">
              + थप्नुहोस्
            </Link>
          </div>
          <ul className="divide-y divide-border/70 text-xs sm:text-sm">
            {upcomingReminders.map((u, i) => (
              <li key={i} className="flex justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">{u.t}</span>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                  <Dt d={u.d} />
                </span>
              </li>
            ))}
            {!upcomingReminders.length && (
              <li className="py-3 text-center text-xs text-muted-foreground">
                कुनै पेन्डिङ रिमाइन्डर वा योजना छैन।
              </li>
            )}
          </ul>
        </section>

        <section className="panel !p-3 sm:!p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">🏆 Research & other activities · अतिरिक्त क्रियाकलाप</h2>
            <Link to="/records" className="text-xs font-semibold text-primary hover:underline">
              हेर्नुहोस् →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {actCounts.map(([c, n]) => (
              <span key={c} className="chip text-[11px]">
                {c}: <b>{n}</b>
              </span>
            ))}
            {!actCounts.length && (
              <span className="py-3 text-xs text-muted-foreground">
                अतिरिक्त क्रियाकलाप रेकर्ड गरिएको छैन — <Link to="/records" className="underline">Records</Link> बाट थप्नुहोस्।
              </span>
            )}
          </div>
        </section>
      </div>

      <footer className="no-print mt-8 border-t border-border pt-4 text-center text-xs font-medium text-muted-foreground">
        © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
      </footer>
    </main>
  );
}
