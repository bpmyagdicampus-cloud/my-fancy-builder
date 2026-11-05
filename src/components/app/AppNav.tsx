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
        return `This academic year is view-only. Only the active academic year can be edited.${
          act ? ` (Active Year: ${act.name})` : ""
        }\n\nयो शैक्षिक वर्ष हेर्न मात्र मिल्छ (View only)। अघिल्लो वर्षमा काम गर्न Admin बाट यस वर्षलाई Active बनाउन लगाउनुहोस्।`;
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

  const allSearchItems: SubMenuItem[] = items.flatMap((m) =>
    m.subs ? m.subs : [{ labelNe: m.ne, labelEn: m.en, to: m.to }]
  );
  const filteredSearch = menuSearch.trim()
    ? allSearchItems.filter(
        (s) =>
          s.labelEn.toLowerCase().includes(menuSearch.trim().toLowerCase()) ||
          s.labelNe.toLowerCase().includes(menuSearch.trim().toLowerCase())
      )
    : [];

  return (
    <header className="no-print sticky top-0 z-30 w-full shrink-0 border-b border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 md:px-5">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 leading-none text-primary md:hidden">
          <img src="/icon-192.png" alt="Shikshak Diary" className="h-9 w-9 shrink-0 rounded-lg shadow-sm" />
          <div className="whitespace-nowrap">
            <span className="block font-display text-base font-bold sm:text-lg">Shikshak Diary</span>
            <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">
              Teacher's Academic Portal
            </span>
          </div>
        </Link>

        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 text-primary transition hover:opacity-90">
            <img src="/icon-192.png" alt="Shikshak Diary" className="h-9 w-9 shrink-0 rounded-lg shadow-sm" />
            <div className="leading-tight">
              <span className="block font-display text-lg font-bold tracking-wide text-primary">
                Shikshak Diary
              </span>
              <span className="block text-[10px] font-medium text-muted-foreground">
                Academic Management
              </span>
            </div>
          </Link>

          <span className="h-6 w-px bg-border" />

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-secondary/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary sm:text-sm">
            <span>🏛️</span>
            <span className="max-w-60 truncate lg:max-w-80">
              {profile?.campus || "MYAGDI MULTIPLE CAMPUS"}
            </span>
          </span>

          {profile?.address && (
            <span className="hidden truncate text-xs font-medium text-muted-foreground xl:inline">
              📍 {profile.address}
            </span>
          )}

          <span className="hidden items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground lg:inline-flex">
            🗓️ {fmtBs(today)}
          </span>
        </div>

        <div className="flex-1" />

        <div className="relative hidden w-44 lg:block xl:w-56">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs transition focus-within:border-primary focus-within:bg-background">
            <Icon n="search" size={15} />
            <input
              type="search"
              placeholder="Quick search..."
              className="w-full bg-transparent text-xs font-medium outline-none sm:text-sm"
              value={menuSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setMenuSearch(e.target.value)}
            />
          </div>
          {searchFocused && filteredSearch.length > 0 && (
            <div className="absolute left-0 right-0 top-10 z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {filteredSearch.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => navigateSub(s)}
                  className="flex w-full flex-col rounded-lg px-3.5 py-2 text-left transition hover:bg-secondary"
                >
                  <span className="text-xs font-bold text-foreground sm:text-sm">{s.labelEn}</span>
                  <span className="text-[11px] text-muted-foreground">{s.labelNe}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {showLinks && profile && yr && (
          <Link
            to="/years"
            className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-bold transition sm:text-sm ${
              past
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
            }`}
            title="Change or manage Academic Year"
          >
            📅 FY {yr.name}
            {past ? <span className="hidden sm:inline">{isAdmin ? " · Inactive" : " · View Only"}</span> : ""}
          </Link>
        )}

        {signedIn ? (
          <Link
            to="/account"
            className="flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-2 sm:pr-3.5 text-xs font-bold shadow-sm transition hover:border-primary/40 hover:bg-muted sm:text-sm"
            title="My Account & Sign Out"
          >
            <Avatar name={c.me?.name} path={c.me?.avatar_path} size={30} />
            <span className="hidden max-w-36 truncate sm:inline">{c.me?.name || c.email}</span>
          </Link>
        ) : (
          <Link to="/login" className="btn-soft shrink-0 whitespace-nowrap !min-h-9 !px-3.5 !py-1.5 text-xs font-bold sm:text-sm">
            Sign in
          </Link>
        )}
      </div>

      {showLinks && (
        <nav
          className="hidden items-center gap-1 overflow-x-auto border-t border-primary/20 bg-primary px-3 py-1.5 text-primary-foreground md:flex lg:gap-1.5 lg:px-5"
          aria-label="Main navigation"
        >
          {items.map((item) => {
            const isOn = active(item.to);
            const hasSubs = !!item.subs && item.subs.length > 0;
            const isOpen = openMenuTo === item.to;

            const displayEn = item.en.toLowerCase().includes("student quality") ? "SQC" : item.en;

            return (
              <div
                key={item.to}
                className="relative shrink-0"
                onMouseEnter={() => hasSubs && setOpenMenuTo(item.to)}
                onMouseLeave={() => hasSubs && setOpenMenuTo(null)}
              >
                <Link
                  to={item.to}
                  onClick={() => setOpenMenuTo(null)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition lg:px-3.5 lg:text-[13px] ${
                    isOn
                      ? "bg-white text-primary font-bold shadow-sm"
                      : "text-primary-foreground/95 hover:bg-white/15 hover:text-white"
                  }`}
                  title={item.en}
                >
                  <Icon n={item.icon} size={15} />
                  <span className="whitespace-nowrap">{displayEn}</span>
                  {hasSubs && <Icon n="chevDown" size={13} />}
                </Link>

                {hasSubs && isOpen && (
                  <div className="absolute left-0 top-full z-50 pt-1.5">
                    <div className="w-64 rounded-xl border border-border bg-card p-1.5 text-foreground shadow-2xl">
                      {item.subs!.map((sub, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => navigateSub(sub)}
                          className="flex w-full flex-col rounded-lg px-3.5 py-2 text-left transition hover:bg-secondary"
                        >
                          <span className="text-sm font-bold text-foreground">{sub.labelEn}</span>
                          <span className="text-[11px] font-medium text-muted-foreground">{sub.labelNe}</span>
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
    </header>
  );
}
