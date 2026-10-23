import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page, Tabs } from "@/components/app/ui";
import { Avatar, BG_PRESETS } from "@/components/app/auth";
import { changePassword, deleteUnsaved, downloadUnsaved, importLocalToCloud, isStaff, listUnsaved, updateMine, uploadImage, useCloud } from "@/lib/cloud";
import { resizeImage } from "@/lib/image";
import { MIN_PASSWORD, loginOf } from "@/lib/login";
import { exportProfile, markBackup, useDB, useTeacher } from "@/lib/store";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [
    { title: "My account — Shikshak Diary" },
    { name: "description", content: "View your profile, change password and choose your theme." },
    { property: "og:title", content: "My account — Shikshak Diary" },
  ] }),
  component: Account,
});

type AccountTab = "profile" | "password" | "theme" | "recovery";
const applyTheme = (theme: string) => {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", !!dark);
};

function Account() {
  const c = useCloud();
  const db = useDB();
  const { data: teacherData } = useTeacher();
  const [tab, setTab] = useState<AccountTab>("profile");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("system");
  useEffect(() => { try { const t = localStorage.getItem("shikshak-theme") || "system"; setTheme(t); applyTheme(t); } catch { /* browser storage may be unavailable */ } }, []);
  useEffect(() => { applyTheme(theme); try { localStorage.setItem("shikshak-theme", theme); } catch { /* optional preference */ } }, [theme]);
  if (c.status !== "ready" || !c.me) return <Page title="My account" sub="Sign in to view your account and manage preferences."><p className="text-sm text-muted-foreground">You are using the old on-device mode. <a className="underline" href="/login">Sign in</a>.</p></Page>;

  const pick = async (kind: "avatar" | "bg", file?: File) => {
    if (!file) return;
    setBusy(true); setNote("");
    try {
      const blob = await resizeImage(file, kind === "avatar" ? 320 : 1600, kind === "avatar" ? 0.85 : 0.75);
      setNote((await uploadImage(kind, blob)) ?? (kind === "avatar" ? "Photo updated." : "Background updated."));
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const savePw = async () => {
    if (pw.a.length < MIN_PASSWORD) return setNote(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (pw.a !== pw.b) return setNote("The two passwords do not match.");
    const err = await changePassword(pw.a);
    setNote(err ?? "Password changed successfully.");
    if (!err) setPw({ a: "", b: "" });
  };
  const downloadCurrentBackup = () => {
    if (!c.userId) return setNote("Sign in before downloading the current diary backup.");
    try {
      const blob = new Blob([exportProfile(c.userId)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `teacher-diary-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      markBackup(); setNote("Backup downloaded. Keep another copy on an external drive or protected cloud folder.");
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  };
  const legacy = db.profiles.filter((p) => !c.cloudIds.includes(p.id));
  const own = c.userId ? db.data[c.userId] : undefined;
  const ownHasData = !!own && own.diary.length + own.units.length + own.assess.length + own.classes.length > 0;

  return (
    <Page title="My account · मेरो खाता" sub={`${c.me.name} · ${loginOf(c.email)} · ${c.roles.join(", ")}`}>
      <div className="mb-4"><Tabs value={tab} onChange={(v) => { setTab(v as AccountTab); setNote(""); }} items={[["profile", "View profile · प्रोफाइल"], ["password", "Change password"], ["theme", "Change theme"], ["recovery", "Data & recovery"]]} /></div>
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm" role="status">{note}</p>}

      {tab === "profile" && <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <section className="panel"><div className="mb-3 flex justify-center"><Avatar name={c.me.name} path={c.me.avatar_path} size={100} /></div><div className="text-center font-semibold">{c.me.name}</div><div className="text-center text-sm text-muted-foreground">{c.me.designation || "Teacher"}</div><label className="btn-soft mt-3 w-full cursor-pointer justify-center">{busy ? "Uploading…" : "Change photo"}<input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pick("avatar", e.target.files?.[0])} /></label></section>
        <section className="panel"><h2 className="mb-3 text-lg font-bold">Profile details · व्यक्तिगत विवरण</h2><dl className="grid gap-3 sm:grid-cols-2">
          <ProfileValue label="Full name" value={c.me.name} /><ProfileValue label="Login ID" value={loginOf(c.email)} /><ProfileValue label="Contact email" value={c.me.contactEmail || "Not provided"} /><ProfileValue label="Phone" value={c.me.phone || "Not provided"} /><ProfileValue label="Address" value={c.me.teacherAddress || "Not provided"} /><ProfileValue label="Department" value={c.me.dept || "Not assigned"} /><ProfileValue label="Designation" value={c.me.designation || "Not provided"} /><ProfileValue label="Account role" value={c.roles.join(", ")} /><ProfileValue label="Institution" value={teacherData.settings.institution?.name || c.me.campus || "See Setup → Institutional Profile"} /><ProfileValue label="Campus address" value={teacherData.settings.institution?.address || "Not provided"} /><ProfileValue label="Institution email" value={teacherData.settings.institution?.email || "Not provided"} /><ProfileValue label="Department Head" value={teacherData.settings.institution?.departmentHead || "Not provided"} /><ProfileValue label="Campus Chief" value={teacherData.settings.institution?.campusChief || "Not provided"} /><ProfileValue label="Email used for sign-in" value={c.email || "—"} />
        </dl><p className="mt-4 text-xs text-muted-foreground">Contact and employment details are managed by an administrator under Admin → Accounts.</p></section>
      </div>}

      {tab === "password" && <section className="panel max-w-xl"><h2 className="mb-2 text-lg font-bold">Change password · पासवर्ड परिवर्तन</h2><p className="mb-3 text-sm text-muted-foreground">Use a password with at least {MIN_PASSWORD} characters.</p><div className="space-y-3"><label><span className="lbl">New password</span><input className="field" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></label><label><span className="lbl">Confirm new password</span><input className="field" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></label><button className="btn" onClick={savePw}>Update password</button></div></section>}

      {tab === "theme" && <div className="grid gap-4 md:grid-cols-2">
        <section className="panel"><h2 className="mb-3 text-lg font-bold">App theme · एपको थिम</h2><div className="space-y-2">{([["light", "Light · उज्यालो"], ["dark", "Dark · अँध्यारो"], ["system", "Follow device settings · डिभाइसअनुसार"]] as const).map(([v, label]) => <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${theme === v ? "border-primary bg-accent" : "border-border"}`}><input type="radio" name="app-theme" checked={theme === v} onChange={() => setTheme(v)} /><span>{label}</span></label>)}</div><p className="mt-3 text-xs text-muted-foreground">This preference is stored on this device. Choose it again on each device as needed.</p></section>
        <section className="panel"><h2 className="mb-3 text-lg font-bold">Background · पृष्ठभूमि</h2><div className="flex flex-wrap gap-2">{BG_PRESETS.map((p) => <button key={p.id} title={p.label} onClick={async () => setNote((await updateMine({ bg: p.id === "none" ? null : `preset:${p.id}` })) ?? "Background updated.")} className={`h-14 w-24 rounded-md border text-xs font-medium ${c.me!.bg === `preset:${p.id}` || (p.id === "none" && !c.me!.bg) ? "ring-2 ring-primary" : ""}`} style={{ background: p.css || undefined }}>{p.label}</button>)}<label className="btn-soft cursor-pointer self-center">Own photo…<input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pick("bg", e.target.files?.[0])} /></label></div></section>
      </div>}

      {tab === "recovery" && <div className="grid gap-4">
        <section className="panel"><h2 className="mb-2 text-lg font-bold">Backup & recovery · ब्याकअप</h2><p className="mb-3 text-sm text-muted-foreground">Download a JSON copy of this teacher profile, including plans, classes, students, attendance, records and settings. This does not replace a full Supabase database/Storage backup.</p><div className="flex flex-wrap gap-2"><button className="btn" onClick={downloadCurrentBackup}>Download profile backup (.json)</button><a className="btn-soft" href="/profiles">Manage all profile backups</a></div></section>
        {isStaff(c.roles) && listUnsaved(c.userId).length > 0 && <section className="panel"><h2 className="mb-1 text-lg font-bold">Unsaved copies on this device</h2><p className="mb-3 text-xs text-muted-foreground">Download a recovery copy before deleting it. These files may contain unsynced work.</p><ul className="space-y-1 text-sm">{listUnsaved(c.userId).map((u) => <li key={u.key} className="flex items-center gap-2"><span className="flex-1">{new Date(u.at).toLocaleString()}</span><button className="btn-soft" onClick={() => downloadUnsaved(u.key)}>Download</button><button className="btn-danger" onClick={() => confirm("Delete this unsaved copy from this device? Make sure you downloaded it.") && (deleteUnsaved(u.key), setNote("Deleted."))}>Delete</button></li>)}</ul></section>}
        {isStaff(c.roles) && legacy.length > 0 && c.activeId === c.userId && <section className="panel"><h2 className="mb-1 text-lg font-bold">Move old on-device data to the cloud</h2><p className="mb-3 text-xs text-muted-foreground">Copies a diary saved only on this computer into your cloud account. The old copy stays here. {ownHasData ? "Your cloud diary already has data, so moving may replace existing cloud data." : ""}</p><div className="flex flex-wrap gap-2">{legacy.map((p) => <button key={p.id} className="btn-soft" onClick={() => { if (confirm(`Copy "${p.name}" to your cloud account${ownHasData ? " and REPLACE the existing cloud diary" : ""}?`)) setNote(importLocalToCloud(p.id).msg); }}>{p.name}</button>)}</div></section>}
      </div>}
    </Page>
  );
}
function ProfileValue({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border-b border-border pb-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value}</dd></div>; }
