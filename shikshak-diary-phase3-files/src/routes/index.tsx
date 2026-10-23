import { createFileRoute, Link } from "@tanstack/react-router";
import { useTeacher } from "@/lib/store";
import { todayBs, fmtBs, inRange } from "@/lib/bs";
import { totalLhDone, pct } from "@/lib/progress";
import { ACT_CATS } from "@/lib/constants";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Shikshak Diary — Home" },
    { name: "description", content: "Your classes, course completion, activities and upcoming events at a glance." },
    { property: "og:title", content: "Shikshak Diary — Teacher's Daily Record" },
    { property: "og:description", content: "Daily diary, teaching plans, attendance, assessments and monthly reports for teachers." },
  ] }),
  component: Home,
});

function Home() {
  const { profile, data } = useTeacher();
  const today = todayBs();
  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-5xl text-primary">शिक्षक डायरी</h1>
        <p className="mt-3 text-muted-foreground">Daily teaching records, plans, attendance, assessments and monthly reports — kept on this device.</p>
        <Link to="/profiles" className="btn mt-6">Start — choose or create teacher</Link>
      </main>
    );
  }
  const upcoming = [
    ...data.cal.filter((e) => (e.to || e.from) >= today).map((e) => ({ d: e.from, t: `${e.type}${e.title ? " — " + e.title : ""}`, k: "Calendar" })),
    ...data.reminders.filter((r) => r.date >= today && r.status !== "Done").map((r) => ({ d: r.date, t: `${r.time ? r.time + " · " : ""}${r.title}`, k: "Reminder" })),
    ...data.plans.filter((p) => p.date >= today && p.status !== "Done").map((p) => ({ d: p.date, t: `${p.type}: ${p.title}`, k: "Plan" })),
  ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 10);
  const todayEv = data.cal.filter((e) => inRange(today, e.from, e.to));
  const actCounts = ACT_CATS.map((c) => [c, data.acts.filter((a) => a.category === c).length] as const).filter(([, n]) => n > 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <section className="panel mb-5 bg-gradient-to-br from-secondary to-card">
        <div className="text-sm font-semibold uppercase tracking-wide text-accent-foreground">{profile.campus || "Set campus name in Setup"}</div>
        <h1 className="font-display text-3xl text-primary">{profile.name}</h1>
        <div className="text-muted-foreground">{profile.designation}{profile.dept && ` · ${profile.dept}`}</div>
        <div className="mt-2 text-sm">Today: <b>{fmtBs(today)}</b> {todayEv.map((e) => <span key={e.id} className="chip ml-2">{e.type}</span>)}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/diary" className="btn">+ Today's diary</Link>
          <Link to="/reports" className="btn-soft">Monthly report</Link>
        </div>
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
          <h2 className="mb-2 text-lg font-bold">Coming up</h2>
          <ul className="space-y-1.5 text-sm">
            {upcoming.map((u, i) => <li key={i} className="flex gap-2"><span className="w-32 shrink-0 font-semibold">{fmtBs(u.d)}</span><span className="flex-1">{u.t}</span><span className="chip">{u.k}</span></li>)}
            {!upcoming.length && <li className="text-muted-foreground">Nothing scheduled.</li>}
          </ul>
        </section>
        <section className="panel">
          <h2 className="mb-2 text-lg font-bold">Major activities</h2>
          <ul className="space-y-1 text-sm">
            {actCounts.map(([c, n]) => <li key={c} className="flex justify-between"><span>{c}</span><b>{n}</b></li>)}
            {!actCounts.length && <li className="text-muted-foreground">Record research, extra classes and other work in Records.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
