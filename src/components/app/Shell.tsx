import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/app/auth";
import { isStaff, signOut, useCloud } from "@/lib/cloud";

// Simple inline icons (no extra package needed)
const P: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM8 7h7",
  plan: "M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h6",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1M17 8a3 3 0 0 1 0 6M21 20v-1a4 4 0 0 0-3-3.8",
  folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4",
  admin: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11l2 2 4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  out: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9",
  x: "M6 6l12 12M18 6L6 18",
};
export const Icon = ({ n, size = 20 }: { n: keyof typeof P; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n]} /></svg>
);

type Item = { to: string; ne: string; en: string; icon: keyof typeof P; who: "staff" | "all" | "admin" };
const ITEMS: Item[] = [
  { to: "/", ne: "गृह", en: "Home", icon: "home", who: "staff" },
  { to: "/diary", ne: "दैनिक डायरी", en: "Daily Diary", icon: "book", who: "staff" },
  { to: "/plans", ne: "योजना", en: "Plans", icon: "plan", who: "staff" },
  { to: "/records", ne: "अभिलेख", en: "Records", icon: "folder", who: "staff" },
  { to: "/reports", ne: "प्रतिवेदन", en: "Reports", icon: "chart", who: "staff" },
  { to: "/sqc", ne: "SQC", en: "Student Quality Control", icon: "shield", who: "all" },
  { to: "/years", ne: "शैक्षिक वर्ष", en: "Academic years", icon: "cal", who: "staff" },
  { to: "/setup", ne: "सेटअप", en: "Setup", icon: "sliders", who: "staff" },
  { to: "/admin", ne: "प्रशासन", en: "Admin", icon: "admin", who: "admin" },
  { to: "/account", ne: "मेरो खाता", en: "My account", icon: "user", who: "all" },
];

function useShell() {
  const c = useCloud();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const signed = c.status === "ready" && !!c.userId && !!c.me && c.roles.length > 0 && !c.loadError;
  const local = c.status === "anon" && c.localMode;
  const staff = local || (signed && isStaff(c.roles));
  const admin = signed && c.roles.includes("admin");
  const visible = path === "/login" ? false : signed || local;
  const items = ITEMS.filter((i) => (i.who === "all" ? signed || (local && i.to !== "/account") : i.who === "staff" ? staff : admin));
  const active = (to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"));
  return { c, path, signed, local, staff, admin, visible, items, active };
}

/** Desktop: collapsible left sidebar. */
export function Sidebar() {
  const { c, visible, items, active, signed } = useShell();
  const [collapsed, setCollapsed] = useState(false);
  const nav = useNavigate();
  useEffect(() => { try { setCollapsed(localStorage.getItem("shikshak-sidebar") === "collapsed"); } catch { /* ignore */ } }, []);
  const toggle = () => setCollapsed((v) => { const n = !v; try { localStorage.setItem("shikshak-sidebar", n ? "collapsed" : "open"); } catch { /* ignore */ } return n; });
  if (!visible) return null;
  return (
    <aside className={`no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] md:flex ${collapsed ? "w-[4.25rem]" : "w-64"}`} aria-label="Main navigation">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-3">
        {!collapsed && <Link to="/" className="flex-1 leading-tight text-sidebar-foreground"><span className="block font-display text-xl">शिक्षक डायरी</span><span className="block text-[11px] font-normal tracking-wide opacity-70">Teacher's Diary</span></Link>}
        <button onClick={toggle} className="rounded-md p-2 hover:bg-sidebar-accent" aria-label={collapsed ? "Expand menu" : "Collapse menu"} title={collapsed ? "Expand" : "Collapse"}><Icon n={collapsed ? "right" : "left"} /></button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {items.map((i) => (
          <Link key={i.to} to={i.to} title={`${i.ne} · ${i.en}`} className={`nav-item ${active(i.to) ? "nav-item-on" : ""} ${collapsed ? "justify-center px-0" : ""}`}>
            <Icon n={i.icon} />
            {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate">{i.ne}</span><span className="block truncate text-[11px] font-normal opacity-70">{i.en}</span></span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        {signed ? (
          <button className={`nav-item w-full ${collapsed ? "justify-center px-0" : ""}`} title="बाहिरिनुहोस् · Sign out" onClick={async () => { if (await signOut()) nav({ to: "/login" }); }}>
            <Icon n="out" />{!collapsed && <span>बाहिरिनुहोस् · Sign out</span>}
          </button>
        ) : (
          <Link to="/profiles" className={`nav-item ${collapsed ? "justify-center px-0" : ""}`} title="Teacher profiles"><Icon n="user" />{!collapsed && <span>Teacher profiles</span>}</Link>
        )}
        {signed && !collapsed && c.me && <div className="mt-2 flex items-center gap-2 px-2 text-xs opacity-80"><Avatar name={c.me.name} path={c.me.avatar_path} size={24} /><span className="truncate">{c.me.name}</span></div>}
      </div>
    </aside>
  );
}

/** Phones: app-style bottom navigation with a "More" sheet. */
export function BottomNav() {
  const { signed, local, staff, visible, items, active } = useShell();
  const [more, setMore] = useState(false);
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => { setMore(false); }, [path]);
  if (!visible) return null;
  const primary = staff ? ["/", "/diary", "/sqc", "/reports"] : ["/sqc", "/account"];
  const main = primary.map((to) => items.find((i) => i.to === to)).filter(Boolean) as Item[];
  const rest = items.filter((i) => !primary.includes(i.to));
  const cell = (on: boolean): string => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-primary" : "text-muted-foreground"}`;
  return (
    <>
      {more && (
        <div className="no-print fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-foreground/40" aria-label="Close" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-card p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-2 flex items-center"><span className="flex-1 font-semibold">थप · More</span><button className="rounded-md p-2" onClick={() => setMore(false)} aria-label="Close"><Icon n="x" /></button></div>
            <div className="grid grid-cols-3 gap-2">
              {rest.map((i) => (
                <Link key={i.to} to={i.to} className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border p-2 text-center text-xs font-medium ${active(i.to) ? "bg-accent text-accent-foreground" : ""}`}>
                  <Icon n={i.icon} size={22} /><span>{i.ne}</span><span className="text-[10px] font-normal text-muted-foreground">{i.en}</span>
                </Link>
              ))}
              {!signed && local && <Link to="/profiles" className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border p-2 text-center text-xs font-medium"><Icon n="user" size={22} /><span>शिक्षक</span><span className="text-[10px] font-normal text-muted-foreground">Profiles</span></Link>}
              {signed && <button className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-destructive p-2 text-center text-xs font-medium text-destructive" onClick={async () => { if (await signOut()) { setMore(false); nav({ to: "/login" }); } }}><Icon n="out" size={22} /><span>बाहिरिनुहोस्</span><span className="text-[10px] font-normal">Sign out</span></button>}
            </div>
          </div>
        </div>
      )}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main navigation">
        {main.map((i) => <Link key={i.to} to={i.to} className={cell(active(i.to))}><Icon n={i.icon} /><span>{i.ne}</span></Link>)}
        <button className={cell(more)} onClick={() => setMore((v) => !v)} aria-expanded={more}><Icon n="more" /><span>थप</span></button>
      </nav>
    </>
  );
}

/** Wraps the page area so the sidebar (desktop) and bottom bar (phone) have room. */
export function ShellFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen md:flex">{children}</div>;
}
