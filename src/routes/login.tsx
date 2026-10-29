import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { initAuth, signIn, useCloud } from "@/lib/cloud";
import { initPwa, triggerInstallApp, usePwa } from "@/lib/pwa";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — शिक्षक डायरी (Shikshak Diary)" },
      { name: "description", content: "Sign in to Shikshak Diary." },
      { property: "og:title", content: "Sign in — शिक्षक डायरी" },
      { property: "og:description", content: "Sign in to Shikshak Diary." },
    ],
  }),
  component: Login,
});

function Login() {
  const c = useCloud();
  const pwa = usePwa();
  const nav = useNavigate();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    initAuth();
    initPwa();
  }, []);

  useEffect(() => {
    if (c.status === "ready" && c.userId) nav({ to: "/" });
  }, [c.status, c.userId, nav]);

  const submit = async () => {
    if (!id.trim() || !pw) return setErr("ID र पासवर्ड दुवै लेख्नुहोस्। / Enter ID and password.");
    setBusy(true);
    setErr("");
    const e = await signIn(id, pw);
    if (e) {
      setErr(e);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <div className="flex flex-col items-center text-center">
        <img
          src="/icon-192.png"
          alt="शिक्षक डायरी लोगो"
          className="mb-2.5 h-16 w-16 rounded-2xl shadow-sm"
        />
        <h1 className="font-display text-4xl text-primary">शिक्षक डायरी</h1>
        <p className="text-sm font-semibold tracking-wide text-muted-foreground">Teacher's Diary</p>
        <p className="mt-1 text-xs text-muted-foreground">
          दैनिक शिक्षण अभिलेख, पाठ योजना, हाजिरी र मासिक प्रतिवेदन प्रणाली
        </p>
      </div>

      <div className="panel space-y-3">
        <div>
          <label className="lbl">User ID or e-mail · प्रयोगकर्ता ID वा इमेल</label>
          <input
            className="field"
            autoComplete="username"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div>
          <label className="lbl">Password · पासवर्ड</label>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        {err && <p className="text-sm font-medium text-destructive">{err}</p>}
        <button className="btn w-full" disabled={busy} onClick={submit}>
          {busy ? "Signing in…" : "Sign in · लग-इन गर्नुहोस्"}
        </button>
        <p className="text-xs text-muted-foreground">
          एकपटक लग-इन गरेपछि अफलाइनमा काम गर्दा मोबाइल/कम्प्युटरको स्पेसमा सुरक्षित रहन्छ र इन्टरनेट जोडिएपछि स्वतः क्लाउडमा सेभ हुन्छ।
        </p>
      </div>

      {/* Direct 1-Click Native Install Button (shown only when browser native install prompt is ready) */}
      {pwa.canInstall && !pwa.isStandalone && (
        <button
          type="button"
          className="btn-soft w-full text-xs font-bold text-primary"
          onClick={() => void triggerInstallApp()}
        >
          📲 Install App · मोबाइल/कम्प्युटरमा एप इन्स्टल गर्नुहोस्
        </button>
      )}

      <footer className="mt-2 border-t border-border pt-3 text-center text-xs font-medium text-muted-foreground">
        © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
      </footer>
    </main>
  );
}
