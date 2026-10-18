import type { CalEvent, Data, Leave } from "./store";

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
  d.settings = { ...(d.settings && typeof d.settings === "object" ? d.settings : {}), weeklyOff: Array.isArray(wo) ? wo : [...DEFAULT_WEEKLY_OFF] };
  return d as Data;
}

export const weeklyOffOf = (data?: { settings?: { weeklyOff?: string[] } }) =>
  data?.settings?.weeklyOff ?? DEFAULT_WEEKLY_OFF;
