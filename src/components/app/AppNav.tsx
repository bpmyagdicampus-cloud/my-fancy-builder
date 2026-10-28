import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { daysSinceBackup, getLoadError, setEditGuard, useTeacher } from "@/lib/store";
import { getCloudState, isStaff, listUnsaved, openTeacher, resolveConflict, retryNow, useCloud } from "@/lib/cloud";
import { Avatar } from "@/components/app/auth";
import { activeYear, currentYear, isPast } from "@/lib/years";

const SAVE_LABEL: Record<string, string> = { dirty: "Unsaved…", saving: "Saving…", saved: "Saved ✓", error: "Not saved ⚠", conflict: "Conflict ⚠" };

export function AppNav() {
  const { profile, data } = useTeacher();
  const c = useCloud();
  const [err, setErr] = useState<string | null>(null);
  const [age, setAge] = useState<number | null | undefined>(undefined);
  useEffect(() => { setErr(getLoadError()); setAge(daysSinceBackup()); }, [profile?.id]);
  useEffect(() => {
    setEditGuard((d) => {
      const cs = getCloudState();
      const signed = cs.status === "ready" && !!cs.userId;
      const isAdmin = signed ? cs.roles.includes("admin") : cs.localMode;
      if (isAdmin) return null;
      const cloudActive = cs.yearsReady ? cs.activeYear?.name : null;
      if (isPast(d, cloudActive)) {
        const act = activeYear(d, cloudActive);
        return `यो शैक्षिक वर्ष हेर्न मात्र मिल्छ (View only)। अघिल्लो वर्षमा बाँकी काम गर्नुपरेमा Admin बाट यस वर्षलाई Active बनाउन लगाउनुहोस्।${act ? ` (सक्रिय वर्ष: ${act.name})` : ""}\n\nThis academic year is view-only. Only the active academic year can be edited.`;
      }
      return null;
    });
    return () => setEditGuard(null);
  }, []);

  const signedIn = c.status === "ready" && !!c.userId;
  const staff = signedIn && isStaff(c.roles);
  const isAdmin = signedIn ? c.roles.includes("admin") : c.localMode;
  const hasWork = data.diary.length + data.assess.length + data.units.length > 0;
  const needBackup = !err && !signedIn && !!profile && hasWork && age !== undefined && (age === null || age >= 7);
  const viewingOther = signedIn && !!c.activeId && c.activeId !== c.userId;
  const showLinks = !signedIn || staff;
  const cloudActiveName = c.yearsReady ? c.activeYear?.name : null;
  const yr = currentYear(data);
  const actYr = activeYear(data, cloudActiveName);
  const past = isPast(data, cloudActiveName);

  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2">
        <Link to="/" className="leading-none text-primary md:hidden"><span className="block font-display text-lg">शिक्षक डायरी</span><span className="block text-[10px] font-normal tracking-wide text-muted-foreground">Teacher's Diary</span></Link>
        <div className="flex-1" />
        {showLinks && profile && yr && <Link to="/years" className={past ? "chip !border-destructive !text-destructive" : "chip"} title="Academic year · शैक्षिक वर्ष">{yr.name}{past ? (isAdmin ? " · inactive" : " · view only") : ""}</Link>}
        {staff && c.save !== "idle" && <span className={`chip ${c.save === "error" || c.save === "conflict" ? "!border-destructive !text-destructive" : ""}`}>{SAVE_LABEL[c.save]}</span>}
        {signedIn ? (
          <Link to="/account" className="flex min-h-10 items-center gap-2 rounded-full border border-border py-0.5 pl-0.5 pr-3 text-sm font-medium hover:bg-muted" title="My account · मेरो खाता">
            <Avatar name={c.me?.name} path={c.me?.avatar_path} size={32} /><span className="hidden max-w-40 truncate sm:inline">{c.me?.name || c.email}</span>
          </Link>
        ) : (
          <>
            <Link to="/profiles" className="chip">{profile ? profile.name : "Choose teacher"}</Link>
            {c.status === "anon" && <Link to="/login" className="btn-soft">Sign in</Link>}
          </>
        )}
      </div>
      {viewingOther && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground">
          Admin view: you are editing {profile?.name ?? "another teacher"}'s diary.
          <button className="underline" onClick={() => c.userId && openTeacher(c.userId).catch((e) => alert(e instanceof Error ? e.message : String(e)))}>Back to my own diary</button>
        </div>
      )}
      {staff && profile && !past && c.activeYear && yr && yr.name.toLowerCase() !== c.activeYear.name.toLowerCase() && <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">The active academic year is {c.activeYear.name} (set by the administrator). Your open year is {yr.name}. <Link to="/years" className="underline">Academic years</Link></div>}
      {showLinks && profile && past && (
        <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">
          {isAdmin
            ? <>तपाइँ अघिल्लो/निष्क्रिय शैक्षिक वर्ष ({yr?.name}) मा हुनुहुन्छ। सबै शिक्षकका लागि यसमा काम गर्न मिल्ने बनाउन <Link to="/years" className="underline">Academic years</Link> मा गएर Active गर्नुहोस्।</>
            : <>तपाइँ अघिल्लो शैक्षिक वर्ष ({yr?.name}) हेर्दै हुनुहुन्छ (View only · हेर्न मात्र मिल्ने)। काम गर्न <Link to="/years" className="underline">सक्रिय वर्ष ({actYr?.name}) खोल्नुहोस्</Link>।</>}
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
      {staff && c.save === "error" && <div className="flex flex-wrap items-center justify-center gap-3 bg-destructive px-4 py-1.5 text-xs text-destructive-foreground">Could not save to the cloud ({c.saveMsg}). Your work is kept on this device and is retried automatically.<button className="rounded bg-background px-2 py-0.5 font-semibold text-foreground" onClick={() => void retryNow()}>Try again now</button></div>}
      {staff && listUnsaved(c.userId).length > 0 && <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">A copy of earlier UNSAVED work is stored on this device. <Link to="/account" className="underline">Open My account</Link> to download or delete it.</div>}
      {needBackup && <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">{age === null ? "No backup downloaded yet." : `Last backup was ${age} days ago.`} <Link to="/profiles" className="underline">Download a backup</Link> to keep your data safe.</div>}
    </header>
  );
}
