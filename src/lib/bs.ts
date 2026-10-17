import NepaliDate from "nepali-date-converter";

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
  const [y, m, d] = (s || "").split("-").map(Number);
  return { y, m0: (m || 1) - 1, d: d || 1 };
}

export function adToBs(date: Date) {
  const n = new NepaliDate(date);
  return bsKey(n.getYear(), n.getMonth(), n.getDate());
}

export const todayBs = () => adToBs(new Date());

export function bsToAd(s: string): Date {
  const { y, m0, d } = parseBs(s);
  return new NepaliDate(y, m0, d).toJsDate();
}

export function daysInBsMonth(y: number, m0: number) {
  for (let d = 32; d >= 28; d--) {
    const n = new NepaliDate(y, m0, d);
    if (n.getMonth() === m0 && n.getDate() === d) return d;
  }
  return 30;
}

export const weekday = (s: string) => WEEKDAYS[bsToAd(s).getDay()];

export function fmtBs(s?: string) {
  if (!s) return "—";
  const { y, m0, d } = parseBs(s);
  return `${BS_MONTHS[m0]} ${d}, ${y}`;
}

export function addDaysBs(s: string, n: number) {
  const ad = bsToAd(s);
  ad.setDate(ad.getDate() + n);
  return adToBs(ad);
}

export const inRange = (d: string, from?: string, to?: string) =>
  !!from && d >= from && d <= (to || from);
