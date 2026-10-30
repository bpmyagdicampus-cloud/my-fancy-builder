import * as ND from "nepali-date-converter";

// The package ships CJS/ESM builds whose default export resolves differently in SSR vs browser.
const anyND = ND as any;
const NepaliDate: typeof import("nepali-date-converter").default =
  anyND.default?.default ?? anyND.default ?? anyND;

export const BS_MONTHS = [
  "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const p = (n: number) => String(n).padStart(2, "0");

/** BS date key "YYYY-MM-DD" (month 1-12), sortable as a string. */
export const bsKey = (y: number, m0: number, d: number) => `${y}-${p(m0 + 1)}-${p(d)}`;
export const monthKey = (y: number, m0: number) => `${y}-${p(m0 + 1)}`;

export function parseBs(s: string) {
  if (!s || typeof s !== "string") {
    return { y: 2083, m0: 0, d: 1 };
  }
  const parts = s.split("-").map((x) => parseInt(x, 10));
  const y = !isNaN(parts[0]) && parts[0] >= 2000 && parts[0] <= 2099 ? parts[0] : 2083;
  const m = !isNaN(parts[1]) && parts[1] >= 1 && parts[1] <= 12 ? parts[1] : 1;
  const d = !isNaN(parts[2]) && parts[2] >= 1 && parts[2] <= 32 ? parts[2] : 1;
  return { y, m0: m - 1, d };
}

export function adToBs(date: Date) {
  const n = new NepaliDate(date);
  return bsKey(n.getYear(), n.getMonth(), n.getDate());
}

export const todayBs = () => adToBs(new Date());

export function bsToAd(s: string): Date {
  if (!s || typeof s !== "string" || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(s.trim())) {
    return new Date();
  }
  try {
    const { y, m0, d } = parseBs(s);
    return new NepaliDate(y, m0, d).toJsDate();
  } catch {
    return new Date();
  }
}

export function daysInBsMonth(y: number, m0: number) {
  for (let d = 32; d >= 28; d--) {
    try {
      const n = new NepaliDate(y, m0, d);
      if (n.getMonth() === m0 && n.getDate() === d) return d;
    } catch {
      continue;
    }
  }
  return 30;
}

export const weekday = (s?: string) => {
  if (!s || typeof s !== "string" || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(s.trim())) {
    return "";
  }
  try {
    const ad = bsToAd(s);
    return WEEKDAYS[ad.getDay()] || "";
  } catch {
    return "";
  }
};

export function fmtBs(s?: string) {
  if (!s) return "—";
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(s.trim())) return s;
  try {
    const { y, m0, d } = parseBs(s);
    if (!y || isNaN(y) || isNaN(m0) || isNaN(d) || !BS_MONTHS[m0]) return s;
    return ;
  } catch {
    return s || "—";
  }
}

export function addDaysBs(s: string, n: number) {
  const ad = bsToAd(s);
  ad.setDate(ad.getDate() + n);
  return adToBs(ad);
}

export const inRange = (d: string, from?: string, to?: string) =>
  !!from && d >= from && d <= (to || from);

/** Number of days from `from` to `to`, both included (1 for a single day; 0 if `to` is before `from`). */
export function daysBetween(from?: string, to?: string) {
  if (!from) return 0;
  const a = bsToAd(from).getTime();
  const b = bsToAd(to || from).getTime();
  return b < a ? 0 : Math.round((b - a) / 86400000) + 1;
}
