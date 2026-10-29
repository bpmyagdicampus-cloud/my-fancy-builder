import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTeacher, studentsOf, presentCountOf } from "@/lib/store";
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

      // If current user is admin and has local data.cal events not yet in cloud, auto-sync them!
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
        <div className="panel py-12">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
          </div>
          <h1 className="font-display text-5xl text-primary">शिक्षक डायरी</h1>
          <p className="mt-1 text-base font-semibold tracking-wide text-muted-foreground">
            Teacher's Diary · Smart Academic ERP
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            दैनिक शिक्षण अभिलेख, पाठ योजना, विद्यार्थी हाजिरी, मूल्याङ्कन र मासिक प्रतिवेदन व्यवस्थापन प्रणाली।
          </p>
          <Link to="/profiles" className="btn mt-6">
            सुरु गर्नुहोस् — शिक्षक प्रोफाइल छान्नुहोस् →
          </Link>
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
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
      {/* Modern Hero Banner */}
      <section className="panel relative mb-5 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-secondary/60 to-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                {profile.campus || "Set campus name in Setup"}
              </span>
              <span className="chip text-[11px]">© 2026 Shikshak Diary · Developed by Bishnu Acharya</span>
            </div>
            <h1 className="mt-1 font-display text-2xl text-foreground sm:text-3xl">{profile.name}</h1>
            <div className="text-sm font-medium text-muted-foreground">
              {profile.designation}
              {profile.dept && ` · ${profile.dept}`}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1 text-xs font-semibold shadow-sm">
                📅 आजको मिति: <b className="text-primary">{fmtBs(today)}</b>
              </span>
              {todayEv.map((e) => (
                <span key={e.id} className="chip-on">
                  🎉 {e.title} ({e.type})
                </span>
              ))}
              {!todayEv.length && (
                <span className="text-xs text-muted-foreground">· आज कुनै विशेष बिदा वा कार्यक्रम छैन</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/diary" className="btn shadow-sm">
              + आजको दैनिक डायरी (Daily Diary)
            </Link>
            <Link to="/reports" className="btn-soft">
              📊 मासिक प्रतिवेदन
            </Link>
            <Link to="/department" className="btn-soft">
              🏛️ विभागीय व्यवस्थापन
            </Link>
            <Link to="/sqc" className="btn-soft">
              🛡️ SQC
            </Link>
          </div>
        </div>
      </section>

      {/* 4 Modern KPI Summary Cards */}
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/setup" className="kpi-card block">
          <div className="text-xs font-semibold text-muted-foreground">सक्रिय कक्षा र विषय · Classes</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-primary">{openClasses.length}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {totalStudentsCount} विद्यार्थी
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">कुल दर्ता भएका सक्रिय विषयहरू</div>
        </Link>

        <Link to="/reports" className="kpi-card block">
          <div className="text-xs font-semibold text-muted-foreground">कुल कोर्स प्रगति · Course Progress</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-700">{overallCoursePct}%</span>
            <span className="text-xs font-semibold text-muted-foreground">
              {totalDoneLh}/{totalPlannedLh} LH
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${overallCoursePct}%` }} />
          </div>
        </Link>

        <Link to="/diary" className="kpi-card block">
          <div className="text-xs font-semibold text-muted-foreground">आजको अध्यापन · Today's Diary</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-foreground">{todayDiaryEntries.length}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
              {todayLhCount} LH आज
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            कुल डायरी रेकर्ड: <b>{data.diary.length}</b>
          </div>
        </Link>

        <div className="kpi-card">
          <div className="text-xs font-semibold text-muted-foreground">आगामी कार्यक्रम र कार्य · Upcoming</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-600">{upcomingAnnualEvents.length}</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {upcomingReminders.length} रिमाइन्डर
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">क्याम्पस वार्षिक पात्रो र कार्यसूची</div>
        </div>
      </section>

      {hasAlerts && actSum && (
        <section className="panel mb-5 border-primary/40 bg-primary/5">
          <h2 className="mb-2.5 flex items-center gap-2 text-base font-bold text-primary">
            <span>🔔</span>
            <span>ध्यानाकर्षण तथा जिम्मेवारीहरू · Action Notifications</span>
          </h2>
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

      {/* Campus Annual Calendar created by Admin shown on everyone's Home page */}
      <section className="panel mb-5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
          <div>
            <h2 className="text-lg font-bold">
              📅 Campus Annual Calendar · क्याम्पस वार्षिक क्यालेन्डर
            </h2>
            <p className="text-xs text-muted-foreground">
              क्याम्पस प्रशासनद्वारा निर्धारित वार्षिक शैक्षिक कार्यक्रम, परीक्षा र बिदाहरू
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {mergedAnnualEvents.length > 0 && (
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50">
                <button
                  type="button"
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    !showAllYear && upcomingAnnualEvents.length > 0
                      ? "!bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setShowAllYear(false)}
                >
                  आगामी ({upcomingAnnualEvents.length})
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                    showAllYear || upcomingAnnualEvents.length === 0
                      ? "!bg-primary text-primary-foreground font-semibold shadow-sm"
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
                className="field !h-8 !py-0 !text-xs !w-auto"
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
              <Link to="/setup" className="btn-soft !min-h-8 !py-1 !px-2.5 text-xs">
                Manage in Setup →
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAnnualEvents.slice(0, 9).map((ev) => {
            const isToday = inRange(today, ev.from, ev.to || ev.from);
            const isHol = /holiday|बिदा|vacation/i.test(ev.type);
            const isExam = /exam|परीक्षा/i.test(ev.type);
            return (
              <div
                key={ev.id}
                className={`rounded-xl border p-3 text-xs transition-all hover:shadow-sm ${
                  isToday
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isHol
                    ? "border-destructive/30 bg-destructive/5"
                    : isExam
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border/80 bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isHol
                        ? "bg-destructive text-destructive-foreground"
                        : isExam
                        ? "bg-amber-600 text-white"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {ev.type}
                  </span>
                  {isToday && <span className="font-bold text-primary">आज · Today</span>}
                </div>
                <div className="mt-1.5 font-bold text-sm text-foreground">{ev.title}</div>
                <div className="mt-1 font-medium text-muted-foreground">
                  📅 {fmtBs(ev.from)}
                  {ev.to && ev.to !== ev.from && ` → ${fmtBs(ev.to)}`}
                </div>
                {ev.desc && <div className="mt-1 text-[11px] text-muted-foreground truncate">{ev.desc}</div>}
              </div>
            );
          })}
        </div>

        {!filteredAnnualEvents.length && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {mergedAnnualEvents.length > 0 && !showAllYear ? (
              <p>
                आगामी मितिमा कुनै नयाँ कार्यक्रम छैन।{" "}
                <button
                  type="button"
                  className="text-primary font-semibold underline ml-1"
                  onClick={() => setShowAllYear(true)}
                >
                  वर्षभरिका सबै ({mergedAnnualEvents.length}) कार्यक्रम हेर्नुहोस्
                </button>
              </p>
            ) : (
              <p>
                क्याम्पस वार्षिक क्यालेन्डरमा हाल कुनै कार्यक्रम भेटिएन।{" "}
                {admin
                  ? "Setup मा गएर वार्षिक कार्यक्रमहरू थप्न वा Sync गर्न सक्नुहुन्छ।"
                  : "प्रशासनले कार्यक्रमहरू थप गरेपछि यहाँ देखिनेछ।"}
              </p>
            )}
          </div>
        )}
      </section>

      {/* My Classes — Course Completion */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">📚 My classes — course completion · मेरा कक्षा र कोर्स प्रगति</h2>
        <Link to="/setup" className="text-xs font-semibold text-primary hover:underline">
          + कक्षा वा विद्यार्थी व्यवस्थापन (Setup) →
        </Link>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {openClasses.map((c) => {
          const done = totalLhDone(data.diary, c.id);
          const p = pct(done, c.totalLh);
          const n = data.diary.filter((e) => e.classId === c.id).length;
          const stuCount = studentsOf(c).length;
          const lastEntry = [...data.diary]
            .filter((e) => e.classId === c.id)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          return (
            <div key={c.id} className="panel flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-base text-foreground">{c.name}</div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {c.subject} {c.code && <span className="text-xs">({c.code})</span>}
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {p}%
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      p >= 80 ? "bg-emerald-600" : p >= 40 ? "bg-primary" : "bg-amber-500"
                    }`}
                    style={{ width: `${p}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                  <span>
                    <b>{done}</b> / {c.totalLh} LH
                  </span>
                  <span>· {n} classes taken</span>
                  <span>· {stuCount} students</span>
                </div>
                {lastEntry && (
                  <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
                    पछिल्लो पाठ ({fmtBs(lastEntry.date)}): <b>{lastEntry.topic || "—"}</b> (उपस्थित:{" "}
                    {presentCountOf(lastEntry)})
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-1.5 border-t border-border/60 pt-2.5">
                <Link to="/diary" className="btn-soft !min-h-8 flex-1 !py-1 text-xs">
                  + डायरी
                </Link>
                <Link to="/plans" className="btn-soft !min-h-8 flex-1 !py-1 text-xs">
                  योजना
                </Link>
                <Link to="/reports" className="btn-soft !min-h-8 flex-1 !py-1 text-xs">
                  प्रतिवेदन
                </Link>
              </div>
            </div>
          );
        })}
        {!openClasses.length && (
          <div className="panel col-span-full py-8 text-center text-sm text-muted-foreground">
            अहिलेसम्म कुनै कक्षा थपिएको छैन।{" "}
            <Link to="/setup" className="font-semibold text-primary underline">
              Setup मा गएर आफ्ना कक्षा र विषयहरू थप्नुहोस् →
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-bold">⏰ Upcoming reminders & plans · आगामी कार्यहरू</h2>
            <Link to="/records" className="text-xs font-semibold text-primary hover:underline">
              + थप्नुहोस्
            </Link>
          </div>
          <ul className="divide-y divide-border/70 text-sm">
            {upcomingReminders.map((u, i) => (
              <li key={i} className="flex justify-between gap-2 py-2">
                <span>{u.t}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  <Dt d={u.d} />
                </span>
              </li>
            ))}
            {!upcomingReminders.length && (
              <li className="py-4 text-center text-xs text-muted-foreground">
                कुनै पेन्डिङ रिमाइन्डर वा योजना छैन (Nothing pending).
              </li>
            )}
          </ul>
        </section>

        <section className="panel">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-bold">🏆 Research & other activities · अनुसन्धान र अतिरिक्त क्रियाकलाप</h2>
            <Link to="/records" className="text-xs font-semibold text-primary hover:underline">
              हेर्नुहोस् →
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {actCounts.map(([c, n]) => (
              <span key={c} className="chip">
                {c}: <b>{n}</b>
              </span>
            ))}
            {!actCounts.length && (
              <span className="py-4 text-xs text-muted-foreground">
                अतिरिक्त क्रियाकलाप रेकर्ड गरिएको छैन — <Link to="/records" className="underline">Records</Link> बाट थप्नुहोस्।
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
