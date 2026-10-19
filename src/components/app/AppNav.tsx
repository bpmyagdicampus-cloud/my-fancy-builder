import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { daysSinceBackup, getLoadError, useTeacher } from "@/lib/store";
import { isStaff, openTeacher, resolveConflict, signOut, useCloud } from "@/lib/cloud";
import { Avatar } from "@/components/app/auth";

const LINKS = [
  ["/", "Home"], ["/diary", "Daily Diary"], ["/plans", "Plans"], ["/records", "Records"], ["/reports", "Reports"],
] as const;

const SAVE_LABEL: Record<string, string> = { dirty: "Unsaved…", saving: "Saving…", saved: "Saved ✓", error: "Not saved ⚠", conflict: "Conflict ⚠" };

export function AppNav() {
  const { profile, data } = useTeacher();
  const c = useCloud();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [age, setAge] = useState<number | null | undefined>(undefined);
  useEffect(() => { setErr(getLoadError()); setAge(daysSinceBackup()); }, [profile?.id]);
  const signedIn = c.status === "ready" && !!c.userId;
  const staff = signedIn && isStaff(c.roles);
  const hasWork = data.diary.length + data.assess.length + data.units.length > 0;
  const needBackup = !err && !signedIn && !!profile && hasWork && age !== undefined && (age === null || age >= 7);
  const viewingOther = signedIn && !!c.activeId && c.activeId !== c.userId;
  const showLinks = !signedIn || staff;

  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
        <Link to="/" className="mr-3 font-display text-xl text-primary">शिक्षक डायरी</Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {showLinks && LINKS.map(([to, l]) => (
            <Link key={to} to={to} className="tab" activeProps={{ className: "tab-on" }} activeOptions={{ exact: to === "/" }}>{l}</Link>
          ))}
          {signedIn && (c.roles.includes("admin") || c.roles.includes("student")) && <Link to="/sqc" className="tab" activeProps={{ className: "tab-on" }}>Student Quality Control (SQC)</Link>}
          {signedIn && c.roles.includes("admin") && <Link to="/admin" className="tab" activeProps={{ className: "tab-on" }}>Admin</Link>}
        </nav>
        {staff && c.save !== "idle" && <span className={`chip ${c.save === "error" || c.save === "conflict" ? "!border-destructive !text-destructive" : ""}`}>{SAVE_LABEL[c.save]}</span>}
        {signedIn ? (
          <>
            <Link to="/account" className="flex items-center gap-2 rounded-full border border-border py-0.5 pl-0.5 pr-3 text-sm font-medium hover:bg-muted">
              <Avatar name={c.me?.name} path={c.me?.avatar_path} size={28} />{c.me?.name || c.email}
            </Link>
            {staff && <Link to="/setup" className="btn">⚙ Setup</Link>}
            <button className="btn-soft" onClick={async () => { if (await signOut()) nav({ to: "/login" }); }}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/profiles" className="chip">{profile ? profile.name : "Choose teacher"}</Link>
            <Link to="/setup" className="btn">⚙ Setup</Link>
            {c.status === "anon" && <Link to="/login" className="btn-soft">Sign in</Link>}
          </>
        )}
      </div>
      {viewingOther && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground">
          Admin view: you are editing {profile?.name ?? "another teacher"}'s diary.
          <button className="underline" onClick={() => c.userId && void openTeacher(c.userId)}>Back to my own diary</button>
        </div>
      )}
      {err && <div className="bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground">{err} Changes are not being saved — go to <Link to="/profiles" className="underline">Teacher profiles</Link> → Restore from backup.</div>}
      {staff && c.save === "conflict" && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
          <span>{c.saveMsg} Which copy do you want to keep?</span>
          <button className="rounded bg-background px-2 py-1 font-semibold text-foreground" onClick={() => confirm("Keep THIS device's copy and overwrite the cloud copy?") && void resolveConflict("keep-mine")}>Keep this device's copy</button>
          <button className="rounded bg-background px-2 py-1 font-semibold text-foreground" onClick={() => confirm("Use the cloud copy? This device's copy will be downloaded as a file first.") && void resolveConflict("use-cloud")}>Use cloud copy</button>
        </div>
      )}
      {staff && c.save === "error" && <div className="bg-destructive px-4 py-1.5 text-center text-xs text-destructive-foreground">Could not save to the cloud ({c.saveMsg}). Your work is kept on this device and will be retried automatically.</div>}
      {needBackup && <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">{age === null ? "No backup downloaded yet." : `Last backup was ${age} days ago.`} <Link to="/profiles" className="underline">Download a backup</Link> to keep your data safe.</div>}
    </header>
  );
}
