import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/components/app/ui";
import { Avatar, BG_PRESETS } from "@/components/app/auth";
import {
  changePassword,
  deleteUnsaved,
  downloadUnsaved,
  isStaff,
  listUnsaved,
  retryNow,
  signOut,
  updateMine,
  uploadImage,
  useCloud,
} from "@/lib/cloud";
import { resizeImage } from "@/lib/image";
import { MIN_PASSWORD, loginOf } from "@/lib/login";
import { refreshStorageEstimate, triggerInstallApp, usePwa } from "@/lib/pwa";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — Shikshak Diary" },
      { name: "description", content: "Change your photo, password, background or sign out." },
      { property: "og:title", content: "My account — Shikshak Diary" },
      { property: "og:description", content: "Change your photo, password, background or sign out." },
    ],
  }),
  component: Account,
});

function Account() {
  const c = useCloud();
  const pwa = usePwa();
  const nav = useNavigate();
  const [pw, setPw] = useState({ a: "", b: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"profile" | "password" | "theme">("profile");

  useEffect(() => {
    refreshStorageEstimate();
  }, []);

  if (c.status !== "ready" || !c.me) {
    return (
      <Page title="My account · मेरो खाता" sub="Sign in to manage your account.">
        <p className="text-sm text-muted-foreground">
          कृपया आफ्नो खाता व्यवस्थापन गर्न{" "}
          <a className="underline font-semibold text-primary" href="/login">
            लग-इन (Sign in)
          </a>{" "}
          गर्नुहोस्।
        </p>
      </Page>
    );
  }

  const handleSignOut = async () => {
    if (await signOut()) {
      nav({ to: "/login" });
    }
  };

  const pick = async (kind: "avatar" | "bg", file?: File) => {
    if (!file) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await resizeImage(file, kind === "avatar" ? 320 : 1600, kind === "avatar" ? 0.85 : 0.75);
      setNote((await uploadImage(kind, blob)) ?? (kind === "avatar" ? "Photo updated." : "Background updated."));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const savePw = async () => {
    if (pw.a.length < MIN_PASSWORD) return setNote(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (pw.a !== pw.b) return setNote("The two passwords do not match.");
    setNote((await changePassword(pw.a)) ?? "Password changed.");
    setPw({ a: "", b: "" });
  };

  const me = c.me;
  const row = (l: string, v?: string | null) => (
    <div className="flex gap-3 border-b border-border py-2 text-sm">
      <div className="w-36 shrink-0 text-muted-foreground">{l}</div>
      <div className="min-w-0 flex-1 break-words font-medium">{v || "—"}</div>
    </div>
  );
  const tab = (k: "profile" | "password" | "theme", ne: string, en: string) => (
    <button
      key={k}
      className={view === k ? "btn" : "btn-soft"}
      onClick={() => {
        setView(k);
        setNote("");
      }}
    >
      {ne} · {en}
    </button>
  );

  const isSynced = c.save === "idle" || c.save === "saved";

  return (
    <Page
      title="My account · मेरो खाता"
      sub={`${me.name} · ID: ${loginOf(c.email)} · ${c.roles.join(", ")}`}
      actions={
        <button type="button" className="btn-danger" onClick={() => void handleSignOut()}>
          🚪 बाहिरिनुहोस् · Sign out
        </button>
      }
    >
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      <div className="no-print mb-4 flex flex-wrap gap-2">
        {tab("profile", "प्रोफाइल हेर्नुहोस्", "View profile")}
        {tab("password", "पासवर्ड परिवर्तन", "Change password")}
        {tab("theme", "थिम परिवर्तन", "Change theme")}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {view === "profile" && (
          <>
            <section className="panel md:col-span-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Profile · प्रोफाइल</h2>
                <button type="button" className="btn-danger !min-h-9 !px-3 !py-1 text-xs" onClick={() => void handleSignOut()}>
                  🚪 बाहिरिनुहोस् · Sign out
                </button>
              </div>
              <div className="mb-3 flex items-center gap-4">
                <Avatar name={me.name} path={me.avatar_path} size={72} />
                <label className="btn-soft cursor-pointer">
                  {busy ? "Uploading…" : "Change photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => pick("avatar", e.target.files?.[0])}
                  />
                </label>
              </div>
              {row("Name · नाम", me.name)}
              {row("Login ID", loginOf(c.email))}
              {row("Role · भूमिका", c.roles.join(", "))}
              {row("Designation · पद", me.designation)}
              {row("Department · विभाग", me.dept)}
              {row("Campus · क्याम्पस", me.campus)}
              {row("Address · ठेगाना", me.address)}
              {row("Head of department", me.hod)}
              {row("Campus chief", me.chief)}
              <p className="mt-3 text-xs text-muted-foreground">
                These details are set by the administrator. Please ask the administrator if something needs to be corrected.
              </p>
            </section>

            {/* Mobile/Desktop App Install & Offline Device Space + Auto-Cloud Sync Card */}
            <section className="panel md:col-span-2 border-primary/30 bg-secondary/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src="/icon-192.png" alt="शिक्षक डायरी" className="h-11 w-11 rounded-xl shadow-sm" />
                  <div>
                    <h2 className="text-base font-bold text-primary">
                      📲 शिक्षक डायरी एप र अफलाइन-क्लाउड अटो सिंक
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      डिभाइस स्पेस प्रयोग: <b>{pwa.storageUsedKb} KB</b>{" "}
                      {pwa.persisted ? "· (Persistent Device Storage Active ✓)" : "· (On-Device Storage Active ✓)"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pwa.canInstall && !pwa.isStandalone && (
                    <button
                      type="button"
                      className="btn text-xs"
                      onClick={() => void triggerInstallApp()}
                    >
                      📲 Install App · एप इन्स्टल गर्नुहोस्
                    </button>
                  )}
                  {pwa.isStandalone && (
                    <span className="chip-on">✓ एप इन्स्टल भइसकेको छ (App Installed)</span>
                  )}
                  {isSynced ? (
                    <span className="chip-on">☁️ Cloud Saved ✓</span>
                  ) : (
                    <button type="button" className="btn-soft text-xs" onClick={() => void retryNow()}>
                      🔄 Sync now · अहिले सिंक गर्नुहोस्
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {isSynced
                  ? "तपाईंको सम्पूर्ण डाटा क्लाउडमा सुरक्षित छ। इन्टरनेट नभएको बेला (अफलाइनमा) काम गर्दा यही मोबाइल वा कम्प्युटरको स्पेसमा सुरक्षित रहन्छ र अनलाइन हुनेबित्तिकै स्वतः क्लाउडमा जान्छ।"
                  : "तपाईंले अफलाइनमा गर्नुभएको काम यस मोबाइल/कम्प्युटरको स्पेसमा सुरक्षित छ। इन्टरनेट जोडिएपछि स्वतः क्लाउडमा अपलोड हुनेछ।"}
              </p>
            </section>

            {isStaff(c.roles) && listUnsaved(c.userId).length > 0 && (
              <section className="panel md:col-span-2">
                <h2 className="mb-1 text-lg font-bold">Unsaved backup copies on this device</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Made when you signed out while changes could not be uploaded.
                </p>
                <ul className="space-y-1 text-sm">
                  {listUnsaved(c.userId).map((u) => (
                    <li key={u.key} className="flex items-center gap-2">
                      <span className="flex-1">{new Date(u.at).toLocaleString()}</span>
                      <button className="btn-soft" onClick={() => downloadUnsaved(u.key)}>
                        Download
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() =>
                          confirm("Do you want to permanently delete this backup copy?") &&
                          (deleteUnsaved(u.key), setNote("Deleted."))
                        }
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        {view === "password" && (
          <section className="panel">
            <h2 className="mb-3 text-lg font-bold">Change password · पासवर्ड परिवर्तन</h2>
            <div className="space-y-2">
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={pw.a}
                onChange={(e) => setPw({ ...pw, a: e.target.value })}
              />
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={pw.b}
                onChange={(e) => setPw({ ...pw, b: e.target.value })}
              />
              <button className="btn" onClick={savePw}>
                Change password
              </button>
            </div>
          </section>
        )}
        {view === "theme" && (
          <section className="panel md:col-span-2">
            <h2 className="mb-3 text-lg font-bold">Change theme · थिम परिवर्तन</h2>
            <p className="mb-2 text-xs text-muted-foreground">Choose a background colour, or use your own photo.</p>
            <div className="flex flex-wrap gap-2">
              {BG_PRESETS.map((p) => (
                <button
                  key={p.id}
                  title={p.label}
                  onClick={async () =>
                    setNote((await updateMine({ bg: p.id === "none" ? null : `preset:${p.id}` })) ?? "Theme updated.")
                  }
                  className={`h-14 w-24 rounded-md border text-xs font-medium ${
                    me.bg === `preset:${p.id}` || (p.id === "none" && !me.bg) ? "ring-2 ring-primary" : ""
                  }`}
                  style={{ background: p.css || undefined }}
                >
                  {p.label}
                </button>
              ))}
              <label className="btn-soft cursor-pointer self-center">
                Own photo…
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => pick("bg", e.target.files?.[0])}
                />
              </label>
            </div>
          </section>
        )}
      </div>
    </Page>
  );
}
