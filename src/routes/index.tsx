import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTeacher } from "@/lib/store";
import { todayBs, fmtBs, inRange } from "@/lib/bs";
import { totalLhDone, pct } from "@/lib/progress";
import { ACT_CATS } from "@/lib/constants";
import { useCloud } from "@/lib/cloud";
import * as C from "@/lib/campus";
import * as D from "@/lib/dm";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Shikshak Diary — Home" },
    { name: "description", content: "Your classes, course completion, campus annual calendar, activities and upcoming events at a glance." },
    { property: "og:title", content: "Shikshak Diary — Teacher's Daily Record" },
    { property: "og:description", content: "Daily diary, teaching plans, attendance, campus annual calendar and monthly reports." },
  ] }),
  component: Home,
});

function Home() {
  const { profile, data } = useTeacher();
  const cl = useCloud();
  const lk = C.useLookup();
  const [actSum, setActSum] = useState<D.ActionSummary | null>(null);
  const [campusEvents, setCampusEvents] = useState<D.CampusAnnualEvent[]>([]);
  const [calTypes, setCalTypes] = useState<D.CampusCalType[]>([]);
  const [calFilter, setCalFilter] = useState("");
  const today = todayBs();

  const admin = cl.roles.includes("admin");
  const headDepts = lk.heads.filter((h) => h.user_id === cl.userId).map((h) => h.department_id);

  useEffect(() => {
    void Promise.all([D.loadCampusAnnualEvents(), D.loadCalTypes()]).then(([evList, tList]) => {
      setCampusEvents(evList);
      setCalTypes(tList);
    });
  }, []);

  useEffect(() => {
    if (cl.status !== "ready" || !cl.userId) {
      setActSum(null);
      return;
    }
    void D.loadActionSummary(cl.userId, admin, headDepts).then(setActSum);
  }, [cl.status, cl.userId, admin, headDepts.join(",")]);

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-5xl text-primary">शिक्षक डायरी</h1>
        <p className="mt-1 text-base font-medium tracking-wide text-muted-foreground">Teacher's Diary</p>
        <p className="mt-3 text-muted-foreground">Daily teaching records, plans, attendance, assessments and monthly reports — kept on this device.</p>
        <Link to="/profiles" className="btn mt-6">Start — choose or create teacher</Link>
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
  const filteredAnnualEvents = calFilter
    ? upcomingAnnualEvents.filter((e) => e.type === calFilter)
    : upcomingAnnualEvents;

  const todayEv = mergedAnnualEvents.filter((e) => inRange(today, e.from, e.to || e.from));

  const upcomingReminders = [
    ...data.reminders.filter((r) => r.date >= today && r.status !== "Done").map((r) => ({ d: r.date, t: `${r.time ? r.time + " · " : ""}${r.title}`, k: "Reminder" })),
    ...data.plans.filter((p) => p.date >= today && p.status !== "Done").map((p) => ({ d: p.date, t: `${p.type}: ${p.title}`, k: "Plan" })),
  ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 8);

  const actCounts = ACT_CATS.map((c) => [c, data.acts.filter((a) => a.category === c).length] as const).filter(([, n]) => n > 0);

  const hasAlerts =
    !!actSum &&
    (actSum.submittedPlans > 0 ||
      actSum.pendingBudgetLines > 0 ||
      actSum.pendingRevisions > 0 ||
      actSum.myAssignedActivities > 0 ||
      actSum.pendingSqcReports > 0);

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <section className="panel mb-5 bg-gradient-to-br from-secondary to-card">
        <div className="text-sm font-semibold uppercase tracking-wide text-accent-foreground">{profile.campus || "Set campus name in Setup"}</div>
        <h1 className="font-display text-3xl text-primary">{profile.name}</h1>
        <div className="text-muted-foreground">{profile.designation}{profile.dept && ` · ${profile.dept}`}</div>
        <div className="mt-2 text-sm">
          Today: <b>{fmtBs(today)}</b>{" "}
          {todayEv.map((e) => (
            <span key={e.id} className="chip ml-1.5 font-medium">
              {e.title} ({e.type})
            </span>
          ))}
          {!todayEv.length && <span className="ml-2 text-xs text-muted-foreground">· आज कुनै विशेष कार्यक्रम/बिदा छैन</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/diary" className="btn">+ Today's diary</Link>
          <Link to="/reports" className="btn-soft">Monthly report</Link>
          <Link to="/department" className="btn-soft">विभागीय व्यवस्थापन · Department</Link>
          <Link to="/sqc" className="btn-soft">SQC</Link>
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

      {/* Requirement: Campus Annual Calendar created by Admin shown on everyone's Home page */}
      <section className="panel mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div>
            <h2 className="text-lg font-bold">
              Campus Annual Calendar · क्याम्पस वार्षिक क्यालेन्डर
            </h2>
            <p className="text-xs text-muted-foreground">
              क्याम्पस प्रशासनद्वारा निर्धारित वार्षिक शैक्षिक कार्यक्रम, परीक्षा र बिदाहरू
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {calTypes.length > 0 && (
              <select
                className="field !h-8 !py-0 !text-xs !w-auto"
                value={calFilter}
                onChange={(e) => setCalFilter(e.target.value)}
              >
                <option value="">All events · सबै प्रकार ({upcomingAnnualEvents.length})</option>
                {calTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {admin && (
              <Link to="/setup" className="btn-soft !py-1 !px-2 text-xs">
                Manage in Setup →
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAnnualEvents.slice(0, 9).map((ev) => {
            const isToday = inRange(today, ev.from, ev.to || ev.from);
            const isHol = /holiday|बिदा/i.test(ev.type);
            const isExam = /exam|परीक्षा/i.test(ev.type);
            return (
              <div
                key={ev.id}
                className={`rounded-lg border p-3 text-xs ${
                  isToday
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isHol
                    ? "border-destructive/30 bg-destructive/5"
                    : isExam
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
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
          <p className="py-2 text-center text-xs text-muted-foreground">
            आगामी कुनै कार्यक्रम भेटिएन। {admin ? "Setup मा गएर वार्षिक कार्यक्रमहरू थप्न सक्नुहुन्छ।" : ""}
          </p>
        )}
      </section>

      <h2 className="mb-2 text-lg font-bold">My classes — course completion</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.classes.filter((c) => !c.closed).map((c) => {
          const done = totalLhDone(data.diary, c.id);
          const p = pct(done, c.totalLh);
          return (
            <div key={c.id} className="panel">
              <div className="font-bold">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.subject} {c.code}</div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${p}%` }} /></div>
              <div className="mt-1 text-xs text-muted-foreground">{done} / {c.totalLh} LH · {p}% · {data.diary.filter((d) => d.classId === c.id).length} classes taken</div>
            </div>
          );
        })}
        {!data.classes.filter((c) => !c.closed).length && <Link to="/setup" className="panel text-sm text-muted-foreground">No classes yet — add them in Setup →</Link>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel">
          <h2 className="mb-2 text-lg font-bold">Reminders & Tasks · रिमाइन्डर</h2>
          <ul className="space-y-1.5 text-sm">
            {upcomingReminders.map((u, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-28 shrink-0 font-semibold">{fmtBs(u.d)}</span>
                <span className="flex-1">{u.t}</span>
                <span className="chip">{u.k}</span>
              </li>
            ))}
            {!upcomingReminders.length && <li className="text-muted-foreground">Nothing scheduled.</li>}
          </ul>
        </section>
        <section className="panel">
          <h2 className="mb-2 text-lg font-bold">Major activities · मुख्य गतिविधिहरू</h2>
          <ul className="space-y-1 text-sm">
            {actCounts.map(([c, n]) => <li key={c} className="flex justify-between"><span>{c}</span><b>{n}</b></li>)}
            {!actCounts.length && <li className="text-muted-foreground">Record research, extra classes and other work in Records.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
