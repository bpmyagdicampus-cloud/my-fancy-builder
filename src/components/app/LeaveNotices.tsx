import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BS_DATE_RE, createLeave, deleteLeave, loadUpcomingLeaves, respondLeave, type LeaveNotice } from "@/lib/leave";

type Dept = { id: string; name: string };

type Props = {
  userId: string | null;
  teacherName: string;
  today: string;
  departments: Dept[];
  /** null = admin (सबै विभाग), array = प्रमुख भएका विभागहरू, [] = जवाफ दिने अधिकार छैन */
  managedDeptIds: string[] | null;
};

export function LeaveNotices({ userId, teacherName, today, departments, managedDeptIds }: Props) {
  const [items, setItems] = useState<LeaveNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ dept: "", from: "", to: "", reason: "" });
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? "—";
  const canRespondTo = (deptId: string | null) =>
    managedDeptIds === null || (!!deptId && managedDeptIds.includes(deptId));

  const load = useCallback(async () => {
    try {
      setItems(await loadUpcomingLeaves(today));
      setErr("");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setOk("");
    setErr("");
    if (!userId) return setErr("Login आवश्यक छ।");
    if (!form.dept) return setErr("विभाग छान्नुहोस्।");
    if (!BS_DATE_RE.test(form.from) || !BS_DATE_RE.test(form.to))
      return setErr("मिति YYYY-MM-DD ढाँचामा लेख्नुहोस्, जस्तै 2083-07-20।");
    if (form.to < form.from) return setErr("अन्त्य मिति सुरु मितिभन्दा अगाडि हुन सक्दैन।");
    if (form.to < today) return setErr("विगतको मितिमा विदा दर्ता गर्न मिल्दैन।");
    setBusy(true);
    try {
      await createLeave({
        userId,
        teacherName,
        departmentId: form.dept,
        from: form.from,
        to: form.to,
        reason: form.reason,
      });
      setForm({ dept: "", from: "", to: "", reason: "" });
      setOk("✅ विदा अभिलेख भयो।");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (n: LeaveNotice) => {
    if (!userId || !replyText.trim()) return;
    setBusy(true);
    try {
      await respondLeave(n.id, userId, replyText);
      setReplyFor(null);
      setReplyText("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (n: LeaveNotice) => {
    if (!confirm("यो विदा अभिलेख मेट्ने?")) return;
    try {
      await deleteLeave(n.id);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  };

  const mine = items.filter((n) => n.teacher_user_id === userId);
  const others = items.filter((n) => n.teacher_user_id !== userId && canRespondTo(n.department_id));

  return (
    <section className="panel mb-5">
      <h2 className="mb-2 text-base font-bold">Leave Notices · विदा सूचना</h2>

      <details className="mb-3 rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">+ विदा अभिलेख गर्नुहोस् · Record leave</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className="field" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
            <option value="">विभाग छान्नुहोस् · Department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="कारण (वैकल्पिक) · Reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <input
            className="field"
            placeholder="सुरु मिति 2083-07-20"
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value.trim() })}
          />
          <input
            className="field"
            placeholder="अन्त्य मिति 2083-07-22"
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value.trim() })}
          />
        </div>
        <button className="btn mt-3" disabled={busy} onClick={submit}>
          {busy ? "सेभ हुँदै…" : "विदा दर्ता गर्नुहोस्"}
        </button>
      </details>

      {err && <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</p>}
      {ok && <p className="mb-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs">{ok}</p>}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {mine.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-bold text-muted-foreground">मेरा विदा · My leave</div>
              {mine.map((n) => (
                <NoticeCard key={n.id} n={n} deptName={deptName(n.department_id)}>
                  {n.response_text ? (
                    <div className="mt-2 rounded-lg bg-emerald-500/10 p-2 text-xs">
                      <b>जवाफ · Response:</b> {n.response_text}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">जवाफ बाँकी छ · No response yet</div>
                  )}
                  <button className="mt-2 text-xs text-destructive underline" onClick={() => remove(n)}>
                    मेटाउनुहोस्
                  </button>
                </NoticeCard>
              ))}
            </div>
          )}

          {others.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-bold text-muted-foreground">सहकर्मीका विदा · Team leave</div>
              {others.map((n) => (
                <NoticeCard key={n.id} n={n} deptName={deptName(n.department_id)}>
                  {n.response_text ? (
                    <div className="mt-2 rounded-lg bg-emerald-500/10 p-2 text-xs">
                      <b>जवाफ · Response:</b> {n.response_text}
                    </div>
                  ) : replyFor === n.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        className="field min-h-16"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="जवाफ लेख्नुहोस् (जस्तै: कक्षा व्यवस्था मिलाइयो)"
                      />
                      <div className="flex gap-2">
                        <button className="btn" disabled={busy} onClick={() => sendReply(n)}>
                          पठाउनुहोस्
                        </button>
                        <button className="btn-soft" onClick={() => setReplyFor(null)}>
                          रद्द
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="mt-2 btn-soft !min-h-8 !px-3 !py-1 text-xs"
                      onClick={() => {
                        setReplyFor(n.id);
                        setReplyText("");
                      }}
                    >
                      जवाफ दिनुहोस्
                    </button>
                  )}
                </NoticeCard>
              ))}
            </div>
          )}

          {mine.length === 0 && others.length === 0 && (
            <p className="text-xs text-muted-foreground">आज वा भविष्यका कुनै विदा सूचना छैनन्।</p>
          )}
        </div>
      )}
    </section>
  );
}

function NoticeCard({ n, deptName, children }: { n: LeaveNotice; deptName: string; children: ReactNode }) {
  return (
    <div className="mb-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b>{n.teacher_name || "शिक्षक"}</b>
        <span className="chip">{deptName}</span>
        <span className="text-xs text-muted-foreground">
          {n.leave_from === n.leave_to ? n.leave_from : `${n.leave_from} → ${n.leave_to}`}
        </span>
      </div>
      {n.reason && <div className="mt-1 text-xs">{n.reason}</div>}
      {children}
    </div>
  );
}
