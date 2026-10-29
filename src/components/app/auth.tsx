import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { initAuth, isStaff, retryLoad, signOut, useCloud, useSignedUrl } from "@/lib/cloud";

export const BG_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "none", label: "Default", css: "" },
  { id: "sky", label: "Sky", css: "linear-gradient(135deg,#e0f2fe,#f0f9ff 50%,#dbeafe)" },
  { id: "leaf", label: "Leaf", css: "linear-gradient(135deg,#dcfce7,#f0fdf4 50%,#d1fae5)" },
  { id: "sand", label: "Sand", css: "linear-gradient(135deg,#fef3c7,#fffbeb 50%,#fde68a)" },
  { id: "rose", label: "Rose", css: "linear-gradient(135deg,#ffe4e6,#fff1f2 50%,#fecdd3)" },
  { id: "lilac", label: "Lilac", css: "linear-gradient(135deg,#ede9fe,#faf5ff 50%,#ddd6fe)" },
  { id: "slate", label: "Slate", css: "linear-gradient(135deg,#e2e8f0,#f1f5f9 50%,#cbd5e1)" },
];

/** Page background chosen by the signed-in user (preset colour or own photo). Never printed. */
export function Background() {
  const c = useCloud();
  const bg = c.me?.bg ?? "";
  const url = useSignedUrl(bg.startsWith("image:") ? bg.slice(6) : null);
  let style: React.CSSProperties | null = null;
  if (bg.startsWith("preset:")) {
    const css = BG_PRESETS.find((p) => p.id === bg.slice(7))?.css;
    if (css) style = { background: css };
  } else if (url) style = { background: `center / cover no-repeat fixed url("${url}")` };
  if (!style) return null;
  return <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10" style={style} />;
}

export function Avatar({ name, path, size = 32 }: { name?: string; path?: string | null; size?: number }) {
  const url = useSignedUrl(path);
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const st = { width: size, height: size, fontSize: Math.max(10, size / 2.6) } as const;
  return url ? (
    <img src={url} alt={name ?? ""} style={st} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={st}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
    >
      {initials}
    </span>
  );
}

const Center = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
    {children}
    <p className="mt-6 text-xs text-muted-foreground">
      © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
    </p>
  </main>
);

/** Decides what a visitor may see: login page, student page, teacher/admin app. */
export function AuthGate({ children }: { children: ReactNode }) {
  const c = useCloud();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  useEffect(() => {
    initAuth();
  }, []);
  useEffect(() => {
    if (c.status === "anon" && !c.localMode && path !== "/login") nav({ to: "/login" });
  }, [c.status, c.localMode, path, nav]);

  if (path === "/login") return <>{children}</>;
  if (c.status === "loading" || (c.status === "anon" && !c.localMode))
    return (
      <Center>
        <h1 className="font-display text-3xl text-primary">शिक्षक डायरी</h1>
        <p className="text-sm text-muted-foreground">Loading… / लोड हुँदैछ…</p>
      </Center>
    );
  if (c.status === "anon") return <>{children}</>; // old "this device only" mode

  if (c.loadError) {
    return (
      <Center>
        <h1 className="font-display text-2xl text-primary">Could not load your diary</h1>
        <p className="text-sm text-muted-foreground">{c.loadError}</p>
        <p className="text-xs text-muted-foreground">
          Nothing was changed or deleted. Check the internet connection and try again.
        </p>
        <div className="flex gap-2">
          <button className="btn" onClick={() => void retryLoad()}>
            Try again
          </button>
          <button className="btn-soft" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </Center>
    );
  }
  if (!c.me || c.roles.length === 0) {
    return (
      <Center>
        <h1 className="font-display text-2xl text-primary">Account not activated</h1>
        <p className="text-sm text-muted-foreground">
          {c.saveMsg || "This login has no role yet. Please ask the administrator to create or fix your account."}
        </p>
        <button className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </Center>
    );
  }
  if (!isStaff(c.roles) && path !== "/account" && path !== "/sqc") {
    return (
      <Center>
        <h1 className="font-display text-2xl text-primary">स्वागत छ, {c.me.name}</h1>
        <p className="text-sm text-muted-foreground">
          Class representatives can submit SQC reports. Everyone can change their photo, password and background.
        </p>
        <div className="flex gap-2">
          <a href="/sqc" className="btn">
            SQC
          </a>
          <a href="/account" className="btn-soft">
            My account
          </a>
        </div>
      </Center>
    );
  }
  if (path.startsWith("/admin") && !c.roles.includes("admin"))
    return (
      <Center>
        <h1 className="font-display text-2xl text-primary">Administrators only</h1>
      </Center>
    );
  return <>{children}</>;
}
