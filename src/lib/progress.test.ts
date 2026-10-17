import { describe, it, expect } from "vitest";
import { lhStats, pct } from "./progress";
import { daysInBsMonth, adToBs, weekday } from "./bs";
import type { Diary } from "./store";

const e = (date: string, lh: number, classId = "a") => ({ classId, date, lh }) as unknown as Diary;

describe("LH progress", () => {
  it("splits previous months, this month and remaining", () => {
    const d = [e("2083-03-10", 3), e("2083-04-01", 2), e("2083-04-20", 1), e("2083-05-01", 4), e("2083-04-02", 9, "b")];
    expect(lhStats(d, "a", 150, "2083-04")).toEqual({ prev: 3, thisMonth: 3, total: 6, remaining: 144 });
  });
  it("percentage caps at 100", () => {
    expect(pct(160, 150)).toBe(100);
    expect(pct(75, 150)).toBe(50);
  });
});

describe("BS dates", () => {
  it("Shrawan 1, 2083 is Friday 17 July 2026", () => {
    expect(adToBs(new Date(2026, 6, 17))).toBe("2083-04-01");
    expect(weekday("2083-04-01")).toBe("Fri");
  });
  it("month lengths are 29-32", () => {
    const n = daysInBsMonth(2083, 3);
    expect(n).toBeGreaterThanOrEqual(29);
    expect(n).toBeLessThanOrEqual(32);
  });
});
