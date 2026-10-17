import type { Diary } from "./store";

const sum = (xs: Diary[]) => xs.reduce((a, e) => a + (Number(e.lh) || 0), 0);

/** Lecture-hour progress of one class for a BS month ("YYYY-MM"). */
export function lhStats(diary: Diary[], classId: string, totalLh: number, month: string) {
  const ds = diary.filter((e) => e.classId === classId);
  const prev = sum(ds.filter((e) => e.date < month));
  const thisMonth = sum(ds.filter((e) => e.date.startsWith(month)));
  const total = prev + thisMonth;
  return { prev, thisMonth, total, remaining: Math.max(0, (Number(totalLh) || 0) - total) };
}

export const totalLhDone = (diary: Diary[], classId: string) => sum(diary.filter((e) => e.classId === classId));
export const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
