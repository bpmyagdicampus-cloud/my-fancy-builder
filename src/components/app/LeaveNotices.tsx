import { useCallback, useEffect, useState, type ReactNode } from "react";
import { loadUpcomingLeaves, respondLeave, type LeaveNotice } from "@/lib/leave";

type Props = {
  userId: string | null;
  today: string;
  departments: { id: string; name: string }[];
  /** null = admin (सबै विभाग), array = प्रमुख भएका विभागहरू */
  managedDeptIds: string[] | null;
};

export function LeaveNotices({ userId, today, departments, managedDeptIds }: Props) {
  const [items, setItems] = useState<LeaveNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
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

  const mine = items.filter((n) => n.teacher_user_id === userId);
  const others = items.filter((n) => n.teacher_user_id !== userId && canRespondTo(n.department_id));

  return (
    <section className="panel mb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">Leave Notices · विदा सूचना</h2>
        <span className="text-[11px] text-muted-foreground">
          विदा थप्ने: Records → Leave
        </span>
      </div>

      {err && (
        <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{err}</p>
      )}

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
