import { BsDate, BsMonth } from "@/components/app/ui";
import { monthKey } from "@/lib/bs";
import { monthRange } from "@/lib/sqc";
import { BS_MONTHS } from "@/lib/bs";

export type Span = { mode: "all" | "month" | "range"; month: string; from: string; to: string };
export const defaultSpan = (today: string): Span => ({ mode: "month", month: today.slice(0, 7), from: today, to: today });
export function spanRange(s: Span): { from?: string; to?: string; label: string } {
  if (s.mode === "month") { const [y, m] = s.month.split("-").map(Number); return { ...monthRange(s.month), label: `${BS_MONTHS[(m || 1) - 1]} ${y}` }; }
  if (s.mode === "range") return { from: s.from, to: s.to, label: `${s.from} → ${s.to}` };
  return { label: "All dates" };
}

/** Month / selected period / all dates selector (BS dates). */
export function PeriodPicker({ value, onChange }: { value: Span; onChange: (s: Span) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div><label className="lbl">Show · अवधि</label>
        <select className="field" value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as Span["mode"] })}>
          <option value="month">Month · महिना</option><option value="range">Selected period · छानिएको अवधि</option><option value="all">All dates · सबै</option>
        </select></div>
      {value.mode === "month" && <div><label className="lbl">Month</label><BsMonth value={value.month || monthKey(2083, 0)} onChange={(v) => onChange({ ...value, month: v })} /></div>}
      {value.mode === "range" && <>
        <div><label className="lbl">From</label><BsDate value={value.from} onChange={(v) => onChange({ ...value, from: v })} /></div>
        <div><label className="lbl">To</label><BsDate value={value.to} onChange={(v) => onChange({ ...value, to: v })} /></div>
      </>}
    </div>
  );
}
