import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLoadError, setEditGuard, useTeacher } from "@/lib/store";
import { getCloudState, isStaff, listUnsaved, openTeacher, resolveConflict, retryNow, useCloud } from "@/lib/cloud";
import { Avatar } from "@/components/app/auth";
import { activeYear, currentYear, isPast } from "@/lib/years";
import { triggerInstallApp, usePwa } from "@/lib/pwa";
import { fmtBs, todayBs } from "@/lib/bs";
import { dispatchToggleSidebar, Icon, useShell, type SubMenuItem } from "@/components/app/Shell";

const SAVE_LABEL: Record<string, string> = {
  dirty: "Saving…",
  saving: "Syncing…",
  saved: "Saved ✓",
  error: "Offline ☁️",
  conflict: "Conflict ⚠",
};

export function AppNav() {
  const { profile, data } = useTeacher();
  const c = useCloud();
  const pwa = usePwa();
  const nav = useNavigate();
  const { items, active } = useShell();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [err, setErr] = useState<string | null>(null);
  const [openMenuTo, setOpenMenuTo] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    setErr(getLoadError());
  }, [profile?.id]);

  useEffect(() => {
    setOpenMenuTo(null);
    setSearchFocused(false);
  }, [path]);

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

  if (path === "/login") return null;

  const signedIn = c.status === "ready" && !!c.userId;
  const staff = signedIn && isStaff(c.roles);
  const isAdmin = signedIn ? c.roles.includes("admin") : c.localMode;
  const viewingOther = signedIn && !!c.activeId && c.activeId !== c.userId;
  const showLinks = !signedIn || staff;
  const cloudActiveName = c.yearsReady ? c.activeYear?.name : null;
  const yr = currentYear(data);
  const actYr = activeYear(data, cloudActiveName);
  const past = isPast(data, cloudActiveName);
  const today = todayBs();

  const navigateSub = (sub: SubMenuItem) => {
    setOpenMenuTo(null);
    setMenuSearch("");
    setSearchFocused(false);
    void nav({ to: sub.to as any }).then(() => {
      if (sub.tab) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", sub.tab);
          window.history.replaceState({}, "", url.toString());
        } catch {
          /* ignore */
        }
        window.dispatchEvent(new CustomEvent("shikshak-select-tab", { detail: sub.tab }));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("shikshak-select-tab", { detail: sub.tab }));
        }, 40);
      }
    });
  };

  // All searchable menu/sub-menu destinations for the quick Search Menu bar
  const allSearchItems: SubMenuItem[] = items.flatMap((m) =>
    m.subs
      ? m.subs
      : [{ labelNe: m.ne, labelEn: m.en, to: m.to }]
  );
  const filteredSearch = menuSearch.trim()
    ? allSearchItems.filter(
        (s) =>
          s.labelNe.toLowerCase().includes(menuSearch.trim().toLowerCase()) ||
          s.labelEn.toLowerCase().includes(menuSearch.trim().toLowerCase())
      )
    : [];

  return (
    <header className="no-print sticky top-0 z-30 w-full shrink-0 border-b border-border bg-card shadow-sm">
      {/* Top Tier: Campus Name, Academic Year, Today's Date, Quick Search & User Account */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 sm:gap-2.5 md:px-4">
        {/* Desktop Sidebar Toggle Button (Always visible so user can open/close sidebar anytime) */}
        <button
          type="button"
          onClick={dispatchToggleSidebar}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/60 text-foreground transition hover:bg-muted md:inline-flex"
          title="Open / Close Sidebar · साइडबार खोल्ने वा सानो बनाउने"
        >
          <Icon n="menu" size={17} />
        </button>

        {/* Mobile Logo & Title */}
        <Link to="/" className="flex shrink-0 items-center gap-2 leading-none text-primary md:hidden">
          <img src="/icon-192.png" alt="शिक्षक डायरी" className="h-8 w-8 shrink-0 rounded-lg shadow-sm" />
          <div className="whitespace-nowrap">
            <span className="block font-display text-base sm:text-lg">शिक्षक डायरी</span>
            <span className="block text-[10px] font-medium tracking-wide text-muted-foreground">
              Teacher's Diary
            </span>
          </div>
        </Link>

        {/* Desktop Campus Name & Today's Date Badges (Paathshala-inspired top bar) */}
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-secondary/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary"
          >
            <span>🏛️</span>
            <span className="max-w-64 truncate">{profile?.campus || "MYAGDI MULTIPLE CAMPUS"}</span>
          </Link>
          {profile?.address && (
            <span className="hidden truncate text-xs font-medium text-muted-foreground lg:inline">
              📍 {profile.address}
            </span>
          )}
          <span className="hidden items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground xl:inline-flex">
            🗓️ {fmtBs(today)}
          </span>
        </div>

        <div className="flex-1" />

        {/* Desktop Quick Menu Search (Paathshala-style "Search menu...") */}
        <div className="relative hidden w-48 lg:block xl:w-56">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs">
            <Icon n="search" size={14} />
            <input
              type="search"
              placeholder="Search menu · मेनु खोज्नुहोस्..."
              className="w-full bg-transparent text-xs outline-none"
              value={menuSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setMenuSearch(e.target.value)}
            />
          </div>
          {searchFocused && filteredSearch.length > 0 && (
            <div className="absolute left-0 right-0 top-9 z-50 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {filteredSearch.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => navigateSub(s)}
                  className="flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-secondary"
                >
                  <span className="font-semibold text-foreground">{s.labelNe}</span>
                  <span className="text-[10px] text-muted-foreground">{s.labelEn}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {pwa.canInstall && !pwa.isStandalone && (
          <button
            type="button"
            onClick={() => void triggerInstallApp()}
            className="chip shrink-0 whitespace-nowrap !border-primary/40 !bg-secondary font-semibold text-primary"
            title="मोबाइल वा कम्प्युटरमा एप इन्स्टल गर्नुहोस् · Install App"
          >
            📲 <span className="hidden sm:inline">Install App · </span>एप इन्स्टल
          </button>
        )}

        {showLinks && profile && yr && (
          <Link
            to="/years"
            className={`shrink-0 whitespace-nowrap ${
              past
                ? "chip !border-destructive !text-destructive font-semibold"
                : "chip !border-primary/40 !text-primary font-semibold"
            }`}
            title="Academic year · शैक्षिक वर्ष परिवर्तन वा व्यवस्थापन गर्नुहोस्"
          >
            📅 FY {yr.name}
            {past ? <span className="hidden sm:inline">{isAdmin ? " · inactive" : " · view only"}</span> : ""}
          </Link>
        )}

        {staff && c.save !== "idle" && (
          <span
            className={`chip shrink-0 whitespace-nowrap ${
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
            className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pl-0.5 pr-1 sm:pr-3 text-xs font-semibold shadow-sm transition hover:bg-muted"
            title="My account & Sign out · मेरो खाता र बाहिरिनुहोस्"
          >
            <Avatar name={c.me?.name} path={c.me?.avatar_path} size={28} />
            <span className="hidden max-w-36 truncate sm:inline">{c.me?.name || c.email}</span>
          </Link>
        ) : (
          <Link to="/login" className="btn-soft shrink-0 whitespace-nowrap !min-h-8 !px-3 !py-1 text-xs">
            Sign in
          </Link>
        )}
      </div>

      {/* Second Tier (Desktop Only): Paathshala-Style Horizontal Menu Bar with Dropdown Sub-Menus */}
      {showLinks && (
        <nav
          className="hidden items-center gap-1 border-t border-primary/20 bg-primary px-3 py-1 text-primary-foreground md:flex"
          aria-label="Desktop horizontal navigation with sub-menus"
        >
          {items.map((item) => {
            const isOn = active(item.to);
            const hasSubs = !!item.subs && item.subs.length > 0;
            const isOpen = openMenuTo === item.to;

            return (
              <div
                key={item.to}
                className="relative"
                onMouseEnter={() => hasSubs && setOpenMenuTo(item.to)}
                onMouseLeave={() => hasSubs && setOpenMenuTo((prev) => (prev === item.to ? null : prev))}
              >
                <Link
                  to={item.to}
                  onClick={() => setOpenMenuTo(null)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    isOn
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-primary-foreground/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon n={item.icon} size={15} />
                  <span className="whitespace-nowrap">{item.ne}</span>
                  {hasSubs && <Icon n="chevDown" size={13} />}
                </Link>

                {hasSubs && isOpen && (
                  <div className="absolute left-0 top-full z-50 pt-1">
                    <div className="w-60 rounded-xl border border-border bg-card p-1.5 text-foreground shadow-xl">
                      {item.subs!.map((sub, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => navigateSub(sub)}
                          className="flex w-full flex-col rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-secondary"
                        >
                          <span className="font-semibold text-foreground">{sub.labelNe}</span>
                          <span className="text-[10px] text-muted-foreground">{sub.labelEn}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}

      {viewingOther && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-accent px-4 py-1 text-xs font-medium text-accent-foreground">
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
          <div className="bg-accent px-4 py-1 text-center text-xs font-medium text-accent-foreground">
            सक्रिय शैक्षिक वर्ष <b>{c.activeYear.name}</b> हो, तर तपाइँकोमा <b>{yr.name}</b> खुलेको छ।{" "}
            <Link to="/years" className="underline font-bold ml-1">
              Academic years मा गएर मिलाउनुहोस् →
            </Link>
          </div>
        )}

      {showLinks && profile && past && (
        <div className="bg-accent px-4 py-1 text-center text-xs font-medium text-accent-foreground">
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
        <div className="bg-destructive px-4 py-1.5 text-center text-xs font-semibold text-destructive-foreground">
          {err}
        </div>
      )}

      {staff && c.save === "conflict" && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-destructive px-4 py-1.5 text-xs text-destructive-foreground">
          <span>{c.saveMsg} Which copy do you want to keep?</span>
          <button
            className="rounded bg-background px-2 py-0.5 font-semibold text-foreground"
            onClick={() =>
              confirm("Keep THIS device's copy and overwrite the cloud copy?") && void resolveConflict("keep-mine")
            }
          >
            Keep this device's copy
          </button>
          <button
            className="rounded bg-background px-2 py-0.5 font-semibold text-foreground"
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
        <div className="flex flex-wrap items-center justify-center gap-3 bg-secondary px-4 py-1 text-xs font-medium text-secondary-foreground">
          <span>
            ☁️ अफलाइन सुरक्षा: तपाईंको काम यस मोबाइल/कम्प्युटरको स्पेसमा सुरक्षित छ। इन्टरनेट जोडिएपछि स्वतः क्लाउडमा सर्नेछ।
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
        <div className="bg-accent px-4 py-1 text-center text-xs font-medium text-accent-foreground">
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
