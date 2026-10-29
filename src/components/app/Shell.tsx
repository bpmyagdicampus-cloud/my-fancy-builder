import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/app/auth";
import { isStaff, signOut, useCloud } from "@/lib/cloud";
import { triggerInstallApp, usePwa } from "@/lib/pwa";

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
  dept: "M4 21V8l8-5 8 5v13M9 21v-5h6v5M9 11h.01M15 11h.01",
  plus: "M12 5v14M5 12h14",
  download: "M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2",
  menu: "M4 6h16M4 12h16M4 18h16",
  chevDown: "M6 9l6 6 6-6",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
};

export const Icon = ({ n, size = 20 }: { n: keyof typeof P; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={P[n]} />
  </svg>
);

export type SubMenuItem = { labelNe: string; labelEn: string; to: string; tab?: string };
export type MenuItem = {
  to: string;
  ne: string;
  en: string;
  icon: keyof typeof P;
  who: "staff" | "all" | "admin";
  subs?: SubMenuItem[];
};

export const MENU_ITEMS: MenuItem[] = [
  { to: "/", ne: "गृह", en: "Home", icon: "home", who: "staff" },
  {
    to: "/diary",
    ne: "दैनिक डायरी",
    en: "Daily Diary",
    icon: "book",
    who: "staff",
    subs: [
      { labelNe: "दैनिक डायरी र हाजिरी", labelEn: "Daily Diary & Attendance", to: "/diary" },
      { labelNe: "विद्यार्थी व्यवस्थापन", labelEn: "Manage Students", to: "/students" },
    ],
  },
  {
    to: "/plans",
    ne: "योजना",
    en: "Plans",
    icon: "plan",
    who: "staff",
    subs: [
      { labelNe: "वार्षिक / एकाइ योजना", labelEn: "Annual / Unit Plan", to: "/plans", tab: "annual" },
      { labelNe: "मासिक र दैनिक योजना", labelEn: "Monthly & Daily Plans", to: "/plans", tab: "plans" },
      { labelNe: "पाठ योजना (Lesson Plan)", labelEn: "Lesson Plans", to: "/plans", tab: "lesson" },
      { labelNe: "मिश्रित पाठ योजना", labelEn: "Blended Lesson Plans", to: "/plans", tab: "blended" },
    ],
  },
  {
    to: "/records",
    ne: "अभिलेख",
    en: "Records",
    icon: "folder",
    who: "staff",
    subs: [
      { labelNe: "विद्यार्थी मूल्याङ्कन र परीक्षा", labelEn: "Student Assessments & Exams", to: "/records", tab: "assess" },
      { labelNe: "अनुसन्धान र अतिरिक्त क्रियाकलाप", labelEn: "Research & Other Activities", to: "/records", tab: "acts" },
      { labelNe: "रिमाइन्डर र कार्यहरू", labelEn: "Reminders", to: "/records", tab: "rem" },
      { labelNe: "शिक्षक बिदा अभिलेख", labelEn: "Leave Record", to: "/records", tab: "leave" },
    ],
  },
  {
    to: "/reports",
    ne: "प्रतिवेदन",
    en: "Reports",
    icon: "chart",
    who: "staff",
    subs: [
      { labelNe: "मासिक कार्यसम्पादन प्रतिवेदन", labelEn: "Monthly Performance Report", to: "/reports", tab: "month" },
      { labelNe: "दैनिक प्रतिवेदन", labelEn: "Daily Activity Report", to: "/reports", tab: "day" },
      { labelNe: "विद्यार्थी हाजिरी र प्रगति", labelEn: "Student Attendance & Marks Report", to: "/reports", tab: "student" },
      { labelNe: "योजना र प्रगति तुलना", labelEn: "Plan vs Actual Progress", to: "/reports", tab: "progress" },
    ],
  },
  {
    to: "/department",
    ne: "विभागीय व्यवस्थापन",
    en: "Department",
    icon: "dept",
    who: "staff",
    subs: [
      { labelNe: "विभागीय वार्षिक योजना", labelEn: "Department Plans", to: "/department", tab: "plans" },
      { labelNe: "विभागीय गतिविधिहरू", labelEn: "Department Activities", to: "/department", tab: "activities" },
      { labelNe: "बजेट तथा खर्च", labelEn: "Budget & Expenses", to: "/department", tab: "budget" },
      { labelNe: "शैक्षिक क्यालेन्डर (कक्षागत)", labelEn: "Class Academic Calendar", to: "/department", tab: "calendar" },
      { labelNe: "विभागीय प्रतिवेदन", labelEn: "Department Reports", to: "/department", tab: "reports" },
    ],
  },
  {
    to: "/sqc",
    ne: "SQC",
    en: "Student Quality Control",
    icon: "shield",
    who: "all",
    subs: [
      { labelNe: "SQC प्रतिवेदन सूची", labelEn: "SQC Reports List", to: "/sqc", tab: "list" },
      { labelNe: "नयाँ SQC रिपोर्ट", labelEn: "New SQC Report", to: "/sqc", tab: "new" },
      { labelNe: "SQC सारांश", labelEn: "SQC Summary", to: "/sqc", tab: "summary" },
      { labelNe: "SQC सेटअप", labelEn: "SQC Setup", to: "/sqc", tab: "setup" },
    ],
  },
  {
    to: "/setup",
    ne: "सेटअप",
    en: "Setups",
    icon: "sliders",
    who: "staff",
    subs: [
      { labelNe: "कक्षा र विषय व्यवस्थापन", labelEn: "Classes & Subjects", to: "/setup", tab: "classes" },
      { labelNe: "शिक्षक विवरण", labelEn: "Teachers Details", to: "/setup", tab: "teachers" },
      { labelNe: "क्याम्पस वार्षिक क्यालेन्डर", labelEn: "Campus Annual Calendar", to: "/setup", tab: "calendar" },
      { labelNe: "प्रोफाइल र क्याम्पस संरचना", labelEn: "Profile & Campus Setup", to: "/setup", tab: "campus" },
      { labelNe: "विद्यार्थी अपग्रेड र तान्ने", labelEn: "Upgrade & Pull Students", to: "/students" },
      { labelNe: "शैक्षिक वर्ष व्यवस्थापन", labelEn: "Academic Years", to: "/years" },
    ],
  },
  { to: "/years", ne: "शैक्षिक वर्ष", en: "Academic years", icon: "cal", who: "staff" },
  {
    to: "/admin",
    ne: "प्रशासन",
    en: "Admin",
    icon: "admin",
    who: "admin",
    subs: [
      { labelNe: "प्रयोगकर्ता र खाता व्यवस्थापन", labelEn: "User Accounts & Roles", to: "/admin" },
      { labelNe: "शैक्षिक वर्ष नियन्त्रण", labelEn: "Academic Year Control", to: "/years" },
    ],
  },
  { to: "/account", ne: "मेरो खाता", en: "My account", icon: "user", who: "all" },
];

export function useShell() {
  const c = useCloud();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const signed = c.status === "ready" && !!c.userId && !!c.me && c.roles.length > 0 && !c.loadError;
  const local = c.status === "anon" && c.localMode;
  const staff = local || (signed && isStaff(c.roles));
  const admin = signed && c.roles.includes("admin");
  const visible = path === "/login" ? false : signed || local;
  const items = MENU_ITEMS.filter((i) =>
    i.who === "all" ? signed || (local && i.to !== "/account") : i.who === "staff" ? staff : admin
  );
  const active = (to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"));
  return { c, path, signed, local, staff, admin, visible, items, active };
}

/** Helper to trigger global sidebar toggle from anywhere (e.g. AppNav button or Sidebar button). */
export function dispatchToggleSidebar() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("shikshak-toggle-sidebar"));
  }
}

/**
 * Desktop: Fixed, Gemini-style Open/Close + Mouse-Draggable Resizable Left Sidebar.
 * Never scrolls away when scrolling the center content.
 */
export function Sidebar() {
  const { c, visible, items, active, signed } = useShell();
  const pwa = usePwa();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(248);
  const draggingRef = useRef(false);
  const nav = useNavigate();

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("shikshak-sidebar");
      if (savedMode === "collapsed") setCollapsed(true);
      const savedWidth = Number(localStorage.getItem("shikshak-sidebar-w"));
      if (savedWidth >= 180 && savedWidth <= 340) setWidth(savedWidth);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () =>
    setCollapsed((v) => {
      const n = !v;
      try {
        localStorage.setItem("shikshak-sidebar", n ? "collapsed" : "open");
      } catch {
        /* ignore */
      }
      return n;
    });

  useEffect(() => {
    const onGlobalToggle = () => toggle();
    window.addEventListener("shikshak-toggle-sidebar", onGlobalToggle);
    return () => window.removeEventListener("shikshak-toggle-sidebar", onGlobalToggle);
  }, []);

  // Mouse drag-to-resize handler
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const newW = ev.clientX;
      if (newW < 115) {
        setCollapsed(true);
        try {
          localStorage.setItem("shikshak-sidebar", "collapsed");
        } catch {
          /* ignore */
        }
      } else {
        const clamped = Math.max(180, Math.min(340, newW));
        setCollapsed(false);
        setWidth(clamped);
        try {
          localStorage.setItem("shikshak-sidebar", "open");
          localStorage.setItem("shikshak-sidebar-w", String(clamped));
        } catch {
          /* ignore */
        }
      }
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!visible) return null;

  const sidebarStyle = collapsed ? { width: "4.25rem" } : { width: `${width}px` };

  return (
    <aside
      style={sidebarStyle}
      className="no-print relative hidden h-screen shrink-0 select-none flex-col bg-sidebar text-sidebar-foreground shadow-lg md:flex"
      aria-label="Main navigation"
    >
      {/* Top Header of Sidebar: Gemini-style always-visible Open/Close button */}
      <div
        className={`flex items-center border-b border-sidebar-border py-2.5 ${
          collapsed ? " flex-col justify-center gap-2 px-1.5" : "gap-2.5 px-3"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/60 text-white transition hover:bg-sidebar-accent"
          aria-label={collapsed ? "Open sidebar · साइडबार खोल्नुहोस्" : "Close sidebar · साइडबार सानो बनाउनुहोस्"}
          title={collapsed ? "Open sidebar · मेनु खोल्नुहोस्" : "Collapse sidebar · मेनु सानो बनाउनुहोस्"}
        >
          <Icon n="menu" size={19} />
        </button>

        {!collapsed && (
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 text-sidebar-foreground">
            <img src="/icon-192.png" alt="शिक्षक डायरी" className="h-8 w-8 shrink-0 rounded-lg shadow-sm" />
            <div className="min-w-0 leading-tight">
              <span className="block truncate font-display text-lg tracking-wide text-white">शिक्षक डायरी</span>
              <span className="block truncate text-[10px] font-medium tracking-wider text-sidebar-primary">
                Teacher's Diary
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* Scrollable menu items inside fixed sidebar */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2.5">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            title={`${i.ne} · ${i.en}`}
            className={`nav-item ${active(i.to) ? "nav-item-on" : ""} ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <Icon n={i.icon} />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate leading-snug">{i.ne}</span>
                <span className="block truncate text-[10px] font-normal opacity-65">{i.en}</span>
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Bottom Footer of Sidebar */}
      <div className="border-t border-sidebar-border p-2 space-y-1.5">
        {pwa.canInstall && !pwa.isStandalone && (
          <button
            type="button"
            onClick={() => void triggerInstallApp()}
            className={`nav-item w-full bg-sidebar-accent/70 font-semibold text-white ${
              collapsed ? "justify-center px-0" : ""
            }`}
            title="कम्प्युटर वा मोबाइलमा एप इन्स्टल गर्नुहोस् · Install App"
          >
            <Icon n="download" />
            {!collapsed && <span>📲 एप इन्स्टल</span>}
          </button>
        )}

        {!collapsed && (
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1.5 text-[10px] leading-snug text-sidebar-foreground/85">
            © 2026 Shikshak Diary.
            <br />
            Developed by <b>Bishnu Acharya</b>.
          </div>
        )}

        {signed ? (
          <button
            className={`nav-item w-full ${collapsed ? "justify-center px-0" : ""}`}
            title="बाहिरिनुहोस् · Sign out"
            onClick={async () => {
              if (await signOut()) nav({ to: "/login" });
            }}
          >
            <Icon n="out" />
            {!collapsed && <span>बाहिरिनुहोस् · Sign out</span>}
          </button>
        ) : (
          <Link
            to="/profiles"
            className={`nav-item ${collapsed ? "justify-center px-0" : ""}`}
            title="Teacher profiles"
          >
            <Icon n="user" />
            {!collapsed && <span>Teacher profiles</span>}
          </Link>
        )}

        {signed && !collapsed && c.me && (
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/30 px-2 py-1 text-xs">
            <Avatar name={c.me.name} path={c.me.avatar_path} size={24} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.me.name}</div>
              {c.me.designation && <div className="truncate text-[10px] opacity-70">{c.me.designation}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Mouse Drag Handle on the right edge to resize/collapse/expand sidebar */}
      <div
        onMouseDown={startDrag}
        title="तानेर साइडबार घटाउन वा बढाउन सकिन्छ (Drag to resize sidebar)"
        className="absolute top-0 right-0 z-40 h-full w-1.5 cursor-col-resize transition-colors hover:bg-sidebar-primary/80"
      />
    </aside>
  );
}

/** Phones: Fixed app-style bottom navigation + floating quick action button + "More" bottom sheet. */
export function BottomNav() {
  const { signed, local, staff, visible, items, active, path } = useShell();
  const pwa = usePwa();
  const [more, setMore] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    setMore(false);
  }, [path]);
  if (!visible) return null;

  const primary = staff ? ["/", "/diary", "/plans", "/department"] : ["/sqc", "/account"];
  const main = primary.map((to) => items.find((i) => i.to === to)).filter(Boolean) as MenuItem[];
  const rest = items.filter((i) => !primary.includes(i.to));

  const cell = (on: boolean): string =>
    `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
      on ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <>
      {staff && path !== "/diary" && !more && (
        <Link
          to="/diary"
          className="no-print fixed right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-lg ring-2 ring-background transition-transform active:scale-95 md:hidden"
          title="आजको दैनिक डायरी लेख्नुहोस् · Quick Daily Diary"
        >
          <Icon n="plus" size={15} />
          <span>दैनिक डायरी</span>
        </Link>
      )}

      {more && (
        <div className="no-print fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setMore(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/25" />
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/icon-192.png" alt="" className="h-6 w-6 rounded-md" />
                <span className="text-base font-bold text-foreground">सबै मेनु · All Menus</span>
              </div>
              <button
                className="rounded-full bg-muted p-2 text-muted-foreground hover:text-foreground"
                onClick={() => setMore(false)}
                aria-label="Close"
              >
                <Icon n="x" size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {rest.map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-2.5 text-center text-xs font-semibold transition-all ${
                    active(i.to)
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-muted/30 text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon n={i.icon} size={22} />
                  <span className="leading-tight">{i.ne}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">{i.en}</span>
                </Link>
              ))}
              {pwa.canInstall && !pwa.isStandalone && (
                <button
                  type="button"
                  onClick={() => {
                    setMore(false);
                    void triggerInstallApp();
                  }}
                  className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/40 bg-primary/10 p-2.5 text-center text-xs font-semibold text-primary"
                >
                  <Icon n="download" size={22} />
                  <span>एप इन्स्टल</span>
                  <span className="text-[10px] font-normal">Install App</span>
                </button>
              )}
              {!signed && local && (
                <Link
                  to="/profiles"
                  className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-muted/30 p-2.5 text-center text-xs font-semibold"
                >
                  <Icon n="user" size={22} />
                  <span>शिक्षक</span>
                  <span className="text-[10px] font-normal text-muted-foreground">Profiles</span>
                </Link>
              )}
              {signed && (
                <button
                  className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-destructive/30 bg-destructive/5 p-2.5 text-center text-xs font-semibold text-destructive"
                  onClick={async () => {
                    if (await signOut()) {
                      setMore(false);
                      nav({ to: "/login" });
                    }
                  }}
                >
                  <Icon n="out" size={22} />
                  <span>बाहिरिनुहोस्</span>
                  <span className="text-[10px] font-normal">Sign out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Main navigation"
      >
        {main.map((i) => {
          const on = active(i.to);
          return (
            <Link key={i.to} to={i.to} className={cell(on)}>
              {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <Icon n={i.icon} size={20} />
              <span>{i.ne}</span>
            </Link>
          );
        })}
        <button className={cell(more)} onClick={() => setMore((v) => !v)} aria-expanded={more}>
          <Icon n="more" size={20} />
          <span>थप · More</span>
        </button>
      </nav>
    </>
  );
}

/**
 * Locks the desktop viewport to h-screen overflow-hidden so the Sidebar and Top Menu stay 100% FIXED
 * while only the inner content area scrolls.
 */
export function ShellFrame({ children }: { children: ReactNode }) {
  return <div className="print-scroll-reset min-h-screen md:flex md:h-screen md:overflow-hidden">{children}</div>;
}
