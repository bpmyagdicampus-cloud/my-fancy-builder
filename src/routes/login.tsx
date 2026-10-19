import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { enterLocalMode, initAuth, signIn, useCloud } from "@/lib/cloud";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { title: "Sign in — Shikshak Diary" },
    { name: "description", content: "Sign in to Shikshak Diary." },
    { property: "og:title", content: "Sign in — Shikshak Diary" },
    { property: "og:description", content: "Sign in to Shikshak Diary." },
  ] }),
  component: Login,
});

function Login() {
  const c = useCloud();
  const nav = useNavigate();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { initAuth(); }, []);
  useEffect(() => { if (c.status === "ready" && c.userId) nav({ to: "/" }); }, [c.status, c.userId, nav]);

  const submit = async () => {
    if (!id.trim() || !pw) return setErr("ID र पासवर्ड दुवै लेख्नुहोस्। / Enter ID and password.");
    setBusy(true); setErr("");
    const e = await signIn(id, pw);
    if (e) { setErr(e); setBusy(false); }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <div className="text-center">
        <h1 className="font-display text-4xl text-primary">शिक्षक डायरी</h1>
        <p className="text-sm text-muted-foreground">Teacher's Daily Record — sign in</p>
      </div>
      <div className="panel space-y-3">
        <div><label className="lbl">User ID or e-mail</label><input className="field" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
        <div><label className="lbl">Password</label><input className="field" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
        {err && <p className="text-sm font-medium text-destructive">{err}</p>}
        {c.status === "ready" && !c.userId && null}
        <button className="btn w-full" disabled={busy} onClick={submit}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="text-xs text-muted-foreground">खाता प्रशासक (admin) ले बनाइदिन्छ। ID/पासवर्ड बिर्सिएमा प्रशासकसँग सम्पर्क गर्नुहोस्।</p>
      </div>
      <button className="text-center text-xs text-muted-foreground underline" onClick={() => { enterLocalMode(); nav({ to: "/" }); }}>
        Use old version on this device only (no login)
      </button>
    </main>
  );
}
