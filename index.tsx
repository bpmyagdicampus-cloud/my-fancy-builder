import { createFileRoute, Link } from "@tanstack/react-router";
import { useTeacher, studentsOf } from "@/lib/store";
import { todayBs, fmtBs, inRange } from "@/lib/bs";
import { totalLhDone, pct } from "@/lib/progress";
import { ACT_CATS } from "@/lib/constants";
import { useCloud } from "@/lib/cloud";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "शिक्षक डायरी · Teacher's Diary" },
    { name: "description", content: "Your classes, teaching progress, activities, students and upcoming events at a glance." },
    { property: "og:title", content: "शिक्षक डायरी — Teacher's Diary" },
    { property: "og:description", content: "A practical dashboard for teaching plans, attendance, assessments and reports." },
  ] }),
  component: Home,
});

function Home() {
  const { profile, data } = useTeacher();
  const cloud = useCloud();
  const today = todayBs();
  if (!profile) return <main className="mx-auto max-w-2xl px-4 py-20 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-3xl font-bold text-primary-foreground shadow-lg">शि</div><h1 className="font-display text-4xl text-primary sm:text-5xl">शिक्षक डायरी</h1><p className="mt-1 text-sm tracking-wide text-muted-foreground">Teacher's Diary</p><p className="mx-auto mt-4 max-w-lg text-muted-foreground">Daily teaching records, lesson plans, attendance, assessments and reports—all in one place.</p><Link to="/profiles" className="btn mt-6">Start · Choose teacher</Link></main>;

  const institution = data.settings.institution;
  const campusName = institution?.name || profile.campus || "Campus profile not configured";
  const todayEv = data.cal.filter((e) => inRange(today, e.from, e.to));
  const todayDiary = data.diary.filter((e) => e.date === today);
  const activeClasses = data.classes.filter((c) => !c.closed);
  const totalStudents = activeClasses.reduce((n, cl) => n + studentsOf(cl).length, 0);
  const attended = todayDiary.reduce((n, e) => n + Math.max(0, e.total - e.absent.length), 0);
  const upcoming = [
    ...data.cal.filter((e) => (e.to || e.from) >= today).map((e) => ({ d: e.from, t: `${e.type}${e.title ? " — " + e.title : ""}`, k: "Calendar" })),
    ...data.reminders.filter((r) => r.date >= today && r.status !== "Done").map((r) => ({ d: r.date, t: `${r.time ? r.time + " · " : ""}${r.title}`, k: "Reminder" })),
    ...data.plans.filter((p) => p.date >= today && p.status !== "Done").map((p) => ({ d: p.date, t: `${p.type}: ${p.title}`, k: "Plan" })),
  ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);
  const actCounts = ACT_CATS.map((c) => [c, data.acts.filter((a) => a.category === c).length] as const).filter(([, n]) => n > 0).slice(0, 5);
  const recentActivities = [...data.acts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const saveStatus = cloud.status === "ready" && !!cloud.userId ? (cloud.save === "saved" || cloud.save === "idle" ? "Cloud account" : cloud.save === "error" ? "Sync needs attention" : cloud.save === "conflict" ? "Sync conflict" : "Syncing changes") : "On-device mode";

  return <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
    <section className="relative mb-5 overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-cyan-500/10 p-5 shadow-sm sm:p-7">
      <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-2xl" /><div className="absolute bottom-0 right-24 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl" />
      <div className="relative flex flex-wrap items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground shadow-md">शि</div>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{campusName}</p><h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">नमस्कार, {profile.name}</h1><p className="mt-1 text-sm text-muted-foreground">{profile.designation || "Teacher"}{profile.dept ? ` · ${profile.dept}` : ""} · {fmtBs(today)}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="chip">{saveStatus}</span>{institution?.address && <span className="chip">{institution.address}</span>}{todayEv.map((e) => <span key={e.id} className="chip">{e.type}</span>)}</div></div>
        <Link to="/account" className="btn-soft relative">My account ↗</Link>
      </div>
      <div className="relative mt-5 flex flex-wrap gap-2"><Link to="/diary" className="btn">＋ Today's diary</Link><Link to="/plans" className="btn-soft">＋ Teaching plan</Link><Link to="/reports" className="btn-soft">View reports</Link><Link to="/setup" className="btn-soft">Setup</Link></div>
    </section>

    <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat icon="▦" label="Active classes" value={activeClasses.length} hint="Configured in Setup" />
      <Stat icon="◉" label="Students" value={totalStudents} hint="In active class lists" />
      <Stat icon="✓" label="Classes taught today" value={todayDiary.length} hint={`${attended} student attendances recorded`} />
      <Stat icon="◷" label="Lecture hours recorded" value={data.diary.reduce((n, e) => n + (e.lh || 0), 0)} hint="For the currently open year" />
    </section>

    <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <section className="panel">
        <div className="mb-3 flex flex-wrap items-center gap-2"><div className="flex-1"><h2 className="text-lg font-bold">My classes · पाठ्यक्रम प्रगति</h2><p className="text-xs text-muted-foreground">Lecture-hour progress for each active class</p></div><Link to="/setup" className="text-sm font-semibold text-primary">Manage classes ↗</Link></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {activeClasses.map((cl) => { const done = totalLhDone(data.diary, cl.id); const p = pct(done, cl.totalLh); return <article key={cl.id} className="rounded-2xl border border-border bg-background/70 p-4 transition hover:border-primary/40 hover:shadow-sm"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">{cl.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{cl.name}</h3><p className="truncate text-sm text-muted-foreground">{cl.subject}{cl.code ? ` · ${cl.code}` : ""}</p></div><span className="text-sm font-bold text-primary">{p}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500 transition-all" style={{ width: `${Math.min(100, p)}%` }} /></div><div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground"><span>{done} / {cl.totalLh || 0} LH</span><span>{data.diary.filter((d) => d.classId === cl.id).length} diary entries</span></div></article>; })}
          {!activeClasses.length && <Link to="/setup" className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground sm:col-span-2">No classes yet. Open Setup to add your classes and assigned subjects →</Link>}
        </div>
      </section>
      <section className="panel">
        <div className="mb-3 flex items-center"><div className="flex-1"><h2 className="text-lg font-bold">Coming up · आगामी</h2><p className="text-xs text-muted-foreground">Events, plans and reminders</p></div><span className="rounded-xl bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{upcoming.length}</span></div>
        <ul className="space-y-2">{upcoming.map((u, i) => <li key={`${u.k}-${i}`} className="flex gap-3 rounded-xl border border-border p-3"><div className="min-w-16 rounded-lg bg-muted px-2 py-1 text-center"><div className="text-[10px] text-muted-foreground">BS DATE</div><div className="text-sm font-bold">{u.d.slice(8)}</div><div className="text-[10px] text-muted-foreground">{u.d.slice(0, 7)}</div></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{u.t}</p><span className="text-xs text-muted-foreground">{u.k}</span></div></li>)}{!upcoming.length && <li className="rounded-xl bg-muted/50 p-5 text-center text-sm text-muted-foreground">No upcoming events or reminders.</li>}</ul>
      </section>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <section className="panel"><div className="mb-3"><h2 className="text-lg font-bold">Quick access · छिटो पहुँच</h2><p className="text-xs text-muted-foreground">Common teaching tasks</p></div><div className="grid grid-cols-2 gap-2"><Shortcut to="/diary" icon="✎" title="Daily diary" detail="Attendance & activities"/><Shortcut to="/plans" icon="▤" title="Teaching plans" detail="Annual, monthly, daily"/><Shortcut to="/records" icon="◫" title="Academic records" detail="Assessment & student data"/><Shortcut to="/reports" icon="▥" title="Reports" detail="Progress & performance"/><Shortcut to="/sqc" icon="◎" title="SQC" detail="Quality follow-up"/><Shortcut to="/setup" icon="⚙" title="Setup" detail="Classes, students & campus"/></div></section>
      <section className="panel"><div className="mb-3"><h2 className="text-lg font-bold">Recent activities · हालका गतिविधि</h2><p className="text-xs text-muted-foreground">Your recently recorded academic work</p></div><ul className="space-y-3">{recentActivities.map((a) => <li key={a.id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">✦</span><div className="min-w-0 flex-1"><p className="font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.category} · {fmtBs(a.date)}</p>{a.details && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.details}</p>}</div></li>)}{!recentActivities.length && <li className="rounded-xl bg-muted/50 p-5 text-center text-sm text-muted-foreground">Record research, extra classes or other work in Records.</li>}</ul>{actCounts.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{actCounts.map(([cat, n]) => <span className="chip" key={cat}>{cat}: {n}</span>)}</div>}</section>
    </div>
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground"><span>शिक्षक डायरी · Teacher's Diary</span><span>{institution?.email || "Academic planning · Classroom management · Reporting"}</span></footer>
  </main>;
}

function Stat({ icon, label, value, hint }: { icon: string; label: string; value: number; hint: string }) { return <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">{label}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-lg text-primary">{icon}</span></div><div className="mt-2 text-3xl font-extrabold tracking-tight">{value.toLocaleString()}</div><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>; }
function Shortcut({ to, icon, title, detail }: { to: "/diary" | "/plans" | "/records" | "/reports" | "/sqc" | "/setup"; icon: string; title: string; detail: string }) { return <Link to={to} className="group flex min-h-24 gap-3 rounded-xl border border-border p-3 transition hover:border-primary/40 hover:bg-primary/5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg group-hover:bg-primary/10 group-hover:text-primary">{icon}</span><span className="min-w-0 self-center"><span className="block text-sm font-bold">{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span></span></Link>; }
