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
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Hero Banner: Large Campus Name + Campus Address underneath */}
      <section className="panel mb-5 bg-gradient-to-br from-secondary to-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-primary sm:text-3xl">
              {profile.campus || "MYAGDI MULTIPLE CAMPUS"}
            </h1>
            {profile.address && (
              <div className="text-xs font-medium text-muted-foreground sm:text-sm">
                📍 {profile.address}
              </div>
            )}

            <div className="mt-2 border-t border-border/60 pt-2">
              <div className="text-lg font-bold text-foreground sm:text-xl">{profile.name}</div>
              <div className="text-xs text-muted-foreground sm:text-sm">
                {profile.designation}
                {profile.dept && ` · ${profile.dept}`}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span>
                Today: <b>{fmtBs(today)}</b>
              </span>
              {todayEv.map((e) => (
                <span key={e.id} className="chip-on">
                  {e.title} ({e.type})
                </span>
              ))}
              {!todayEv.length && (
                <span className="text-xs text-muted-foreground">· आज कुनै विशेष कार्यक्रम/बिदा छैन</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/diary" className="btn">
              + Today's diary
            </Link>
            <Link to="/reports" className="btn-soft">
              Monthly report
            </Link>
            <Link to="/department" className="btn-soft">
              विभागीय व्यवस्थापन
            </Link>
            <Link to="/sqc" className="btn-soft">
              SQC
            </Link>
          </div>
        </div>
      </section>

      {/* 4 Uniform, Balanced KPI Cards (2x2 on mobile, 4 equal columns on desktop) */}
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/setup" className="kpi-card flex min-w-0 flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">सक्रिय कक्षा र विषय · Classes</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-extrabold text-primary">{openClasses.length}</span>
              <span className="chip">{totalStudentsCount} विद्यार्थी</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">कुल दर्ता भएका सक्रिय विषयहरू</div>
        </Link>

        {/* Course Progress Card with Per-Class Mini Bar Charts fitting inside the same card size */}
        <Link to="/reports" className="kpi-card flex min-w-0 flex-col justify-between">
          <div className="flex items-baseline justify-between gap-1">
            <span className="truncate text-xs font-semibold text-muted-foreground">कुल कोर्स प्रगति</span>
            <span className="shrink-0 text-sm font-extrabold text-primary">
              {overallCoursePct}% <span className="text-[11px] font-normal text-muted-foreground">({totalDoneLh}/{totalPlannedLh})</span>
            </span>
          </div>
          <div className="mt-1.5 max-h-24 space-y-1 overflow-y-auto pr-0.5">
            {openClasses.map((c) => {
              const done = totalLhDone(data.diary, c.id);
              const p = pct(done, c.totalLh);
              return (
                <div key={c.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-20 shrink-0 truncate font-medium text-foreground" title={`${c.name} · ${c.subject}`}>
                    {c.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(p, done > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right font-bold text-primary">{p}%</span>
                </div>
              );
            })}
            {!openClasses.length && <div className="text-xs text-muted-foreground">कुनै कक्षा छैन</div>}
          </div>
        </Link>

        <Link to="/diary" className="kpi-card flex min-w-0 flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">आजको अध्यापन · Today's Diary</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-extrabold text-foreground">{todayDiaryEntries.length}</span>
              <span className="chip">{todayLhCount} LH आज</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            कुल डायरी रेकर्ड: <b>{data.diary.length}</b>
          </div>
        </Link>

        <div className="kpi-card flex min-w-0 flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">आगामी कार्यक्रम र कार्य · Upcoming</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-extrabold text-primary">{upcomingAnnualEvents.length}</span>
              <span className="chip">{upcomingReminders.length} रिमाइन्डर</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">क्याम्पस वार्षिक पात्रो र कार्यसूची</div>
        </div>
      </section>

      {hasAlerts && actSum && (
        <section className="panel mb-5 border-primary/40">
          <h2 className="mb-2 text-base font-bold">ध्यानाकर्षण तथा जिम्मेवारीहरू · Action Notifications</h2>
          <div className="flex flex-wrap gap-2 text-xs">
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
                बजेट संशोधन अनुरोध (Pending revisions): {actSum.pendingRevisions}
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

      {/* Campus Annual Calendar — 2 per row on mobile, 3 on tablet/desktop */}
      <section className="panel mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div>
            <h2 className="text-base font-bold sm:text-lg">
              Campus Annual Calendar · क्याम्पस वार्षिक क्यालेन्डर
            </h2>
            <p className="text-xs text-muted-foreground">
              क्याम्पस प्रशासनद्वारा निर्धारित वार्षिक शैक्षिक कार्यक्रम, परीक्षा र बिदाहरू
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {mergedAnnualEvents.length > 0 && (
              <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    !showAllYear && upcomingAnnualEvents.length > 0
                      ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setShowAllYear(false)}
                >
                  आगामी ({upcomingAnnualEvents.length})
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    showAllYear || upcomingAnnualEvents.length === 0
                      ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setShowAllYear(true)}
                >
                  वर्षभरिका सबै ({mergedAnnualEvents.length})
                </button>
              </div>
            )}

            {calTypes.length > 0 && (
              <select
                className="field !h-8 !w-auto !py-0 !text-xs"
                value={calFilter}
                onChange={(e) => setCalFilter(e.target.value)}
              >
                <option value="">All types · सबै प्रकार ({targetAnnualEvents.length})</option>
                {calTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {admin && (
              <Link to="/setup" className="btn-soft !px-2.5 !py-1 text-xs">
                Manage in Setup →
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {filteredAnnualEvents.slice(0, 9).map((ev) => {
            const isToday = inRange(today, ev.from, ev.to || ev.from);
            const isHol = /holiday|बिदा|vacation/i.test(ev.type);
            return (
              <div
                key={ev.id}
                className={`min-w-0 rounded-lg border p-2.5 text-xs ${
                  isToday
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isHol
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      isHol
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {ev.type}
                  </span>
                  {isToday && <span className="shrink-0 font-bold text-primary">आज</span>}
                </div>
                <div className="mt-1.5 truncate font-bold text-sm text-foreground" title={ev.title}>
                  {ev.title}
                </div>
                <div className="mt-0.5 truncate font-medium text-muted-foreground">
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

      {/* My Classes — 2 columns on mobile, 3 on desktop */}
      <h2 className="mb-2 text-lg font-bold">My classes — course completion</h2>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {openClasses.map((c) => {
          const done = totalLhDone(data.diary, c.id);
          const p = pct(done, c.totalLh);
          const n = data.diary.filter((e) => e.classId === c.id).length;
          return (
            <Link
              to="/plans"
              key={c.id}
              className="panel block min-w-0 transition hover:border-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-foreground">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground sm:text-sm">
                    {c.subject} {c.code}
                  </div>
                </div>
                <span className="chip shrink-0 font-bold text-primary">{p}%</span>
              </div>
              <div className="my-2 h-2 overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary" style={{ width: `${p}%` }} />
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {done} / {c.totalLh} LH · {p}% · {n} classes taken
              </div>
            </Link>
          );
        })}
        {!openClasses.length && (
          <p className="col-span-full text-sm text-muted-foreground">
            No classes yet — add your classes in <Link to="/setup" className="underline">Setup</Link>.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel">
          <h2 className="mb-2 font-bold">Upcoming reminders & plans</h2>
          <ul className="divide-y divide-border text-sm">
            {upcomingReminders.map((u, i) => (
              <li key={i} className="flex justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">{u.t}</span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  <Dt d={u.d} />
                </span>
              </li>
            ))}
            {!upcomingReminders.length && (
              <li className="text-muted-foreground">Nothing pending.</li>
            )}
          </ul>
        </section>

        <section className="panel">
          <h2 className="mb-2 font-bold">Research & other activities recorded</h2>
          <div className="flex flex-wrap gap-1.5">
            {actCounts.map(([c, n]) => (
              <span key={c} className="chip">
                {c}: <b>{n}</b>
              </span>
            ))}
            {!actCounts.length && (
              <span className="text-sm text-muted-foreground">
                None yet — add in <Link to="/records" className="underline">Records</Link>.
              </span>
            )}
          </div>
        </section>
      </div>

      <footer className="no-print mt-10 border-t border-border pt-4 text-center text-xs font-medium text-muted-foreground">
        © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
      </footer>
    </main>
  );
}
