import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { daysSinceBackup, getLoadError, useTeacher } from "@/lib/store";

const LINKS = [
  ["/", "Home"], ["/diary", "Daily Diary"], ["/plans", "Plans"], ["/records", "Records"], ["/reports", "Reports"],
] as const;

export function AppNav() {
  const { profile, data } = useTeacher();
  const [err, setErr] = useState<string | null>(null);
  const [age, setAge] = useState<number | null | undefined>(undefined);
  useEffect(() => { setErr(getLoadError()); setAge(daysSinceBackup()); }, [profile?.id]);
  const hasWork = data.diary.length + data.assess.length + data.units.length > 0;
  const needBackup = !err && !!profile && hasWork && age !== undefined && (age === null || age >= 7);
  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
        <Link to="/" className="mr-3 font-display text-xl text-primary">शिक्षक डायरी</Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {LINKS.map(([to, l]) => (
            <Link key={to} to={to} className="tab" activeProps={{ className: "tab-on" }} activeOptions={{ exact: to === "/" }}>{l}</Link>
          ))}
        </nav>
        <Link to="/profiles" className="chip">{profile ? profile.name : "Choose teacher"}</Link>
        <Link to="/setup" className="btn">⚙ Setup</Link>
      </div>
      {err && <div className="bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground">{err} Changes are not being saved — go to <Link to="/profiles" className="underline">Teacher profiles</Link> → Restore from backup.</div>}
      {needBackup && <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">{age === null ? "No backup downloaded yet." : `Last backup was ${age} days ago.`} <Link to="/profiles" className="underline">Download a backup</Link> to keep your data safe.</div>}
    </header>
  );
}
