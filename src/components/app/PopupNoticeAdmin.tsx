import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { NOTICE_META, noticeMeta, type NoticeType, type PopupNotice } from "./GlobalNoticeModal";

const errText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as any).message) : String(e);

const db = () => (supabase as any).from("popup_notices");

export function PopupNoticeAdmin({ userId }: { userId?: string | null }) {
  const [items, setItems] = useState<PopupNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({ title: "", content: "", type: "general" as NoticeType, active: true });

  const load = useCallback(async () => {
    const { data, error } = await db().select("*").order("created_at", { ascending: false });
    if (error) setErr(errText(error));
    else {
      setItems((data ?? []) as PopupNotice[]);
      setErr("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    setOk("");
    if (!form.title.trim() || !form.content.trim()) {
      setErr("शीर्षक र सामग्री दुवै आवश्यक छ (Title and content are required).");
      return;
    }
    setBusy(true);
    const { error } = await db().insert({
      title: form.title.trim(),
      content: form.content.trim(),
      notice_type: form.type,
      is_active: form.active,
      created_by: userId ?? null,
    });
    setBusy(false);
    if (error) return setErr(errText(error));
    setForm({ title: "", content: "", type: "general", active: true });
    setOk("✅ सूचना प्रकाशित भयो।");
    await load();
  };

  const toggle = async (n: PopupNotice, next: boolean) => {
    setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_active: next } : x))); // optimistic
    const { error } = await db().update({ is_active: next }).eq("id", n.id);
    if (error) setErr(errText(error));
    await load();
  };

  const remove = async (n: PopupNotice) => {
    if (!confirm(`"${n.title}" मेट्ने? (Delete this notice?)`)) return;
    const { error } = await db().delete().eq("id", n.id);
    if (error) return setErr(errText(error));
    await load();
  };

  return (
    <section className="panel mb-4">
      <h2 className="text-lg font-bold">📢 पप-अप सूचना (Popup Notice)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        सक्रिय सबैभन्दा नयाँ सूचना सबै प्रयोगकर्तालाई एक पटक देखिन्छ। बन्द गरेपछि सोही सूचना फेरि देखिँदैन।
      </p>

      {err && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
          {err}
        </div>
      )}
      {ok && <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-sm">{ok}</div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="lbl">शीर्षक · Title</label>
          <input
            className="field"
            value={form.title}
            maxLength={150}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="lbl">सामग्री · Content</label>
          <textarea
            className="field min-h-28"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
        </div>
        <div>
          <label className="lbl">प्रकार · Type</label>
          <select
            className="field"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as NoticeType })}
          >
            <option value="general">📢 सामान्य</option>
            <option value="urgent">🚨 जरुरी</option>
            <option value="holiday">🏖️ बिदा सम्बन्धी</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          सक्रिय (is_active)
        </label>
      </div>
      <div className="mt-3">
        <button className="btn" disabled={busy} onClick={publish}>
          {busy ? "प्रकाशित हुँदै…" : "📤 प्रकाशित गर्नुहोस्"}
        </button>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-bold">भइरहेका सूचनाहरू</h3>
      {loading ? (
        <p className="text-xs text-muted-foreground">लोड हुँदै…</p>
      ) : !items.length ? (
        <p className="text-xs text-muted-foreground">कुनै सूचना छैन।</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const m = noticeMeta(n.notice_type);
            return (
              <li
                key={n.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 ${
                  n.is_active ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${m.badge}`}>
                      {m.icon} {NOTICE_META[n.notice_type]?.label ?? m.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        n.is_active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {n.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-semibold">{n.title}</div>
                </div>
                <Switch
                  checked={n.is_active}
                  onCheckedChange={(v) => void toggle(n, v)}
                  aria-label="Toggle active"
                />
                <button
                  type="button"
                  className="btn-soft !min-h-8 !px-2.5 !py-1 text-xs !text-destructive"
                  onClick={() => void remove(n)}
                >
                  🗑 मेट्नुहोस्
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
