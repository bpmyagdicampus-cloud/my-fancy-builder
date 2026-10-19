import type { CalEvent, Data, Leave } from "./store";
import { uid } from "./id";
import { ensureRegistry, syncText } from "./students";

/** Weekly off days used when a profile has no setting yet (Saturday + Sunday). */
export const DEFAULT_WEEKLY_OFF = ["Sat", "Sun"];
export const LEGACY_LEAVE_TYPE = "Personal leave";
export const WEEKDAY_FULL: Record<string, string> = {
  Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday",
};

const LIST_KEYS = ["classes", "units", "cal", "lessons", "plans", "diary", "assess", "acts", "reminders", "leaves"] as const;

/**
 * Brings any teacher data (old backup, old localStorage, new format) to the current shape.
 * - never removes existing records
 * - moves "Personal leave" entries out of the academic calendar into `leaves`
 * - adds `settings.weeklyOff` (Sat + Sun) when missing
 * Running it twice gives the same result.
 */
export function normalizeData(raw: unknown): Data {
  const d: any = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as object) } : {};
  for (const k of LIST_KEYS) if (!Array.isArray(d[k])) d[k] = [];

  const leaves: Leave[] = [...d.leaves];
  const seen = new Set(leaves.map((l) => l.id));
  const keepCal: CalEvent[] = [];
  for (const e of d.cal as CalEvent[]) {
    if (e && e.type === LEGACY_LEAVE_TYPE) {
      if (!seen.has(e.id)) {
        leaves.push({ id: e.id, kind: LEGACY_LEAVE_TYPE, from: e.from, to: e.to || e.from, reason: e.title || "" });
        seen.add(e.id);
      }
    } else keepCal.push(e);
  }
  d.cal = keepCal;
  d.leaves = leaves;

  const wo = d.settings?.weeklyOff;
  d.settings = { ...(d.settings && typeof d.settings === "object" ? d.settings : {}), weeklyOff: Array.isArray(wo) ? wo : [...DEFAULT_WEEKLY_OFF], yearId: typeof d.settings?.yearId === "string" ? d.settings.yearId : "" };

  // ---- academic years ----
  if (!Array.isArray(d.years)) d.years = [];
  if (!d.archive || typeof d.archive !== "object" || Array.isArray(d.archive)) d.archive = {};
  if (d.years.length === 0) d.years = [{ id: uid(), name: guessYearName(d) }];
  if (!d.years.some((y: { id: string }) => y.id === d.settings.yearId)) d.settings.yearId = d.years[d.years.length - 1].id;

  // ---- student registry (names stay exactly as they were) ----
  if (!Array.isArray(d.students)) d.students = [];
  ensureRegistry(d as Data);
  syncText(d as Data);
  return d as Data;
}

/** "2083/84" for data whose earliest date is in the 2083 academic year (Shrawan–Chaitra counts as that year; Baisakh–Ashadh as the year before). */
export function guessYearName(d: any): string {
  const dates: string[] = [];
  for (const k of ["diary", "lessons", "plans"]) for (const x of d[k] ?? []) if (typeof x?.date === "string") dates.push(x.date);
  for (const k of ["units", "cal", "leaves"]) for (const x of d[k] ?? []) if (typeof x?.from === "string") dates.push(x.from);
  const ok = dates.filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)).sort();
  let y: number;
  if (ok.length) { const [ys, ms] = ok[0]!.split("-"); y = +ys! - (+ms! <= 3 ? 1 : 0); }
  else { const n = new Date(); y = n.getFullYear() + 56 + (n.getMonth() >= 8 ? 1 : 0) - (n.getMonth() <= 3 ? 1 : 0); }
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

export const weeklyOffOf = (data?: { settings?: { weeklyOff?: string[] } }) =>
  data?.settings?.weeklyOff ?? DEFAULT_WEEKLY_OFF;
