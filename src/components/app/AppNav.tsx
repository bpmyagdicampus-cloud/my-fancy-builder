import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLoadError, setEditGuard, useTeacher } from "@/lib/store";
import { getCloudState, isStaff, listUnsaved, openTeacher, resolveConflict, retryNow, useCloud } from "@/lib/cloud";
import { Avatar } from "@/components/app/auth";
import { activeYear, currentYear, isPast } from "@/lib/years";

const SAVE_LABEL: Record<string, string> = {
  dirty: "Saving locally…",
  saving: "Syncing…",
  saved: "Saved ✓",
  error: "Saved on device ☁️",
  conflict: "Conflict ⚠",
};

export function AppNav() {
  const { profile, data } = useTeacher();
  const c = useCloud();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(getLoadError());
  }, [profile?.id]);

  useEffect(() => {
    setEditGuard((d) => {
      const cs = getCloudState();
      const signed = cs.status === "ready" && !!cs.userId;
      const isAdmin = signed ? cs.roles.includes("admin") : cs.localMode;
      if (isAdmin) return null;
      const cloudActive = cs.yearsReady ? cs.activeYear?.name : null;
      if (isPast(d, cloudActive)) {
        const act = activeYear(d, cloudActive);
        return `यो शैक्षिक वर्ष हेर्न मात्र मिल्छ (View only)। अघिल्लो वर्षमा बाँकी काम गर्नुपरेमा Admin बाट यस वर्षलाई Active बनाउन लगाउनुहोस्।${
          act ? ` (सक्रिय वर्ष: ${act.name})` : ""
        }\n\nThis academic year is view-only. Only the active academic year can be edited.`;
      }
      return null;
    });
    return () => setEditGuard(null);
  }, []);

  const signedIn = c.status === "ready" && !!c.userId;
  const staff = signedIn && isStaff(c.roles);
  const isAdmin = signedIn ? c.roles.includes("admin") : c.localMode;
  const viewingOther = signedIn && !!c.activeId && c.activeId !== c.userId;
  const showLinks = !signedIn || staff;
  const cloudActiveName = c.yearsReady ? c.activeYear?.name : null;
  const yr = currentYear(data);
  const actYr = activeYear(data, cloudActiveName);
  const past = isPast(data, cloudActiveName);

  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2 md:px-5">
        <Link to="/" className="flex items-center gap-2 leading-none text-primary md:hidden">
          <div>
            <span className="block font-display text-lg">शिक्षक डायरी</span>
            <span className="block text-[10px] font-medium tracking-wide text-muted-foreground">
              Teacher's Diary
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <span className="font-semibold text-foreground">
            © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
          </span>
          {profile?.campus && <span>· {profile.campus}</span>}
        </div>

        <div className="flex-1" />

        {showLinks && profile && yr && (
          <Link
            to="/years"
            className={
              past
                ? "chip !border-destructive !text-destructive font-semibold"
                : "chip !border-primary/40 !text-primary font-semibold"
            }
            title="Academic year · शैक्षिक वर्ष परिवर्तन वा व्यवस्थापन गर्नुहोस्"
          >
            📅 {yr.name}
            {past ? (isAdmin ? " · inactive" : " · view only") : ""}
          </Link>
        )}

        {staff && c.save !== "idle" && (
          <span
            className={`chip ${
              c.save === "conflict"
                ? "!border-destructive !text-destructive"
                : c.save === "error"
                ? "!border-primary/40 !text-primary"
                : ""
            }`}
            title={
              c.save === "error"
                ? "अफलाइनमा यस डिभाइसमा सुरक्षित छ, इन्टरनेट जोडिएपछि स्वतः क्लाउडमा सर्छ"
                : undefined
            }
          >
            {SAVE_LABEL[c.save]}
          </span>
        )}

        {signedIn ? (
          <Link
            to="/account"
            className="flex min-h-9 items-center gap-2 rounded-full border border-border bg-background py-0.5 pl-0.5 pr-3 text-xs font-semibold shadow-sm transition hover:bg-muted sm:text-sm"
            title="My account · मेरो खाता"
          >
            <Avatar name={c.me?.name} path={c.me?.avatar_path} size={30} />
            <span className="hidden max-w-40 truncate sm:inline">{c.me?.name || c.email}</span>
          </Link>
        ) : (
          <>
            <Link to="/profiles" className="chip">
              {profile ? profile.name : "Choose teacher"}
            </Link>
            {c.status === "anon" && (
              <Link to="/login" className="btn-soft !min-h-9 !px-3 !py-1 text-xs">
                Sign in
              </Link>
            )}
          </>
        )}
      </div>

      {viewingOther && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground">
          <span>Admin view: you are viewing/editing {profile?.name ?? "another teacher"}'s diary.</span>
          <button
            className="underline font-bold"
            onClick={() =>
              c.userId && openTeacher(c.userId).catch((e) => alert(e instanceof Error ? e.message : String(e)))
            }
          >
            ← Back to my own diary
          </button>
        </div>
      )}

      {staff &&
        profile &&
        !past &&
        c.activeYear &&
        yr &&
        yr.name.trim().toLowerCase() !== c.activeYear.name.trim().toLowerCase() && (
          <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">
            सक्रिय शैक्षिक वर्ष <b>{c.activeYear.name}</b> हो, तर तपाइँकोमा <b>{yr.name}</b> खुलेको छ।{" "}
            <Link to="/years" className="underline font-bold ml-1">
              Academic years मा गएर मिलाउनुहोस् →
            </Link>
          </div>
        )}

      {showLinks && profile && past && (
        <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">
          {isAdmin ? (
            <>
              तपाइँ अघिल्लो/निष्क्रिय शैक्षिक वर्ष ({yr?.name}) मा हुनुहुन्छ। सबै शिक्षकका लागि यसमा काम गर्न मिल्ने बनाउन{" "}
              <Link to="/years" className="underline font-bold">
                Academic years
              </Link>{" "}
              मा गएर Active गर्नुहोस्।
            </>
          ) : (
            <>
              तपाइँ अघिल्लो शैक्षिक वर्ष ({yr?.name}) हेर्दै हुनुहुन्छ (View only · हेर्न मात्र मिल्ने)। काम गर्न{" "}
              <Link to="/years" className="underline font-bold">
                सक्रिय वर्ष ({actYr?.name}) खोल्नुहोस्
              </Link>
              ।
            </>
          )}
        </div>
      )}

      {err && (
        <div className="bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground">
          {err}
        </div>
      )}

      {staff && c.save === "conflict" && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-destructive px-4 py-2 text-sm text-destructive-foreground">
          <span>{c.saveMsg} Which copy do you want to keep?</span>
          <button
            className="rounded bg-background px-2 py-1 font-semibold text-foreground"
            onClick={() =>
              confirm("Keep THIS device's copy and overwrite the cloud copy?") && void resolveConflict("keep-mine")
            }
          >
            Keep this device's copy
          </button>
          <button
            className="rounded bg-background px-2 py-1 font-semibold text-foreground"
            onClick={() =>
              confirm("Use the cloud copy? This device's copy will be downloaded as a file first.") &&
              void resolveConflict("use-cloud")
            }
          >
            Use cloud copy
          </button>
        </div>
      )}

      {staff && c.save === "error" && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-secondary px-4 py-1.5 text-xs font-medium text-secondary-foreground">
          <span>
            ☁️ अफलाइन सुरक्षा: तपाईंको काम यस ब्राउजर/डिभाइसमा सुरक्षित छ। इन्टरनेट जोडिएपछि स्वतः क्लाउडमा सर्नेछ।
          </span>
          <button
            className="rounded border border-border bg-card px-2.5 py-0.5 font-semibold text-primary shadow-sm"
            onClick={() => void retryNow()}
          >
            Sync now · अहिले सिंक गर्नुहोस्
          </button>
        </div>
      )}

      {staff && listUnsaved(c.userId).length > 0 && (
        <div className="bg-accent px-4 py-1.5 text-center text-xs font-medium text-accent-foreground">
          A copy of earlier UNSAVED work is stored on this device.{" "}
          <Link to="/account" className="underline">
            Open My account
          </Link>{" "}
          to download or delete it.
        </div>
      )}
    </header>
  );
}
