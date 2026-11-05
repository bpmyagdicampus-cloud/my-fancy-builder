import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLoadError, setEditGuard, useTeacher } from "@/lib/store";
import { getCloudState, isStaff, listUnsaved, openTeacher, resolveConflict, retryNow, useCloud } from "@/lib/cloud";
import { Avatar } from "@/components/app/auth";
import { activeYear, currentYear, isPast } from "@/lib/years";
import { fmtBs, todayBs } from "@/lib/bs";
import { Icon, useShell, type SubMenuItem } from "@/components/app/Shell";

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
  const nav = useNavigate();
  const { items, active } = useShell();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [err, setErr] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    setErr(getLoadError());
  }, [profile?.id]);

  useEffect(() => {
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

  const allSearchItems: SubMenuItem[] = items.flatMap((m) =>
    m.subs ? m.subs : [{ labelNe: m.ne, labelEn: m.en, to: m.to }]
  );
  const filteredSearch = menuSearch.trim()
    ? allSearchItems.filter(
        (s) =>
          s.labelNe.toLowerCase().includes(menuSearch.trim().toLowerCase()) ||
          s.labelEn.toLowerCase().includes(menuSearch.trim().toLowerCase())
      )
    : [];

  // Blue bar से My account र Academic years हटाइएको छ (avatar र FY badge बाट पहुँच रहन्छ)
  const HIDDEN_FROM_BAR = ["/account", "/years"];
  const barItems = items.filter((i) => !HIDDEN_FROM_BAR.includes(i.to));
  const activeItem = barItems.find((i) => active(i.to));
  const activeSubs = activeItem?.subs ?? [];
  const currentTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;

  return (
    <header className="no-print sticky top-0 z-30 w-full shrink-0 border-b border-border bg-card shadow-sm">
      {/* Top Tier: Campus Name & Address (Desktop), Quick Menu Search & User Account (No install button after login, no toggle button) */}
      <div className="flex items-center gap-2 px-3 py-1.5 sm:gap-2.5 md:px-5">
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

        {/* Desktop Brand & Campus Display on Left */}
        <div className="hidden min-w-0 items-center gap-2.5 md:flex">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-primary">
            <img src="/icon-192.png" alt="शिक्षक डायरी" className="h-8 w-8 shrink-0 rounded-lg shadow-sm" />
            <span className="font-display text-lg tracking-wide text-primary">शिक्षक डायरी</span>
          </Link>
          <span className="text-muted-foreground/50">|</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-secondary/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <span>🏛️</span>
            <span className="max-w-64 truncate">{profile?.campus || "MYAGDI MULTIPLE CAMPUS"}</span>
          </span>
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

        {/* Desktop Quick Menu Search */}
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

      {/* Second Tier (Desktop Only): Clean Horizontal Menu Bar with Dropdown Sub-Menus */}
      {showLinks && (
        <div className="border-t border-primary/20 bg-primary text-primary-foreground">
          <nav className="flex flex-wrap items-center gap-1 px-3 py-1.5 lg:px-5" aria-label="Main navigation">
            {barItems.map((item) => {
              const isOn = active(item.to);
              const displayEn = item.en.toLowerCase().includes("student quality") ? "SQC" : item.en;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition lg:px-3.5 lg:text-[13px] ${
                    isOn
                      ? "bg-white text-primary font-bold shadow-sm"
                      : "text-primary-foreground/95 hover:bg-white/15 hover:text-white"
                  }`}
                  title={item.en}
                >
                  <Icon n={item.icon} size={15} />
                  <span className="whitespace-nowrap">{displayEn}</span>
                </Link>
              );
            })}
          </nav>

          {activeSubs.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5 border-t border-white/15 bg-primary/90 px-3 py-2 lg:px-5"
              aria-label="Sub menu"
            >
              {activeSubs.map((sub, sIdx) => {
                const isCurrent = !!sub.tab && sub.tab === currentTab && path === sub.to;
                return (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => navigateSub(sub)}
                    className={`flex flex-col rounded-lg px-3 py-1.5 text-left transition ${
                      isCurrent
                        ? "bg-white text-primary shadow-sm"
                        : "bg-white/10 text-primary-foreground hover:bg-white/20"
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">{sub.labelEn}</span>
                    <span className="text-[10px] leading-tight opacity-80">{sub.labelNe}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
