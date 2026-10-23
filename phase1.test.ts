import { describe, it, expect } from "vitest";
import { normalizeData, weeklyOffOf } from "@/lib/migrate";

const old = {
  classes: [{ id: "c1" }],
  cal: [
    { id: "a", type: "Personal leave", title: "Family work", from: "2083-05-22", to: "2083-05-22" },
    { id: "b", type: "Public holiday", title: "X", from: "2083-05-12", to: "2083-05-12" },
  ],
  diary: [{ id: "d1" }],
};

describe("phase 1 data migration", () => {
  it("moves Personal leave out of the calendar and keeps everything else", () => {
    const n = normalizeData(old);
    expect(n.cal.map((e) => e.id)).toEqual(["b"]);
    expect(n.leaves).toEqual([{ id: "a", kind: "Personal leave", from: "2083-05-22", to: "2083-05-22", reason: "Family work" }]);
    expect(n.classes).toEqual(old.classes);
    expect(n.diary).toEqual(old.diary);
    expect(n.units).toEqual([]);
  });
  it("is idempotent", () => {
    const once = normalizeData(old);
    expect(normalizeData(once)).toEqual(once);
  });
  it("defaults weekly off to Saturday and Sunday, and respects a saved choice", () => {
    expect(weeklyOffOf(normalizeData({}))).toEqual(["Sat", "Sun"]);
    expect(weeklyOffOf(normalizeData({ settings: { weeklyOff: ["Fri"] } }))).toEqual(["Fri"]);
  });
  it("survives garbage input", () => {
    expect(normalizeData(null).leaves).toEqual([]);
    expect(normalizeData([1, 2]).cal).toEqual([]);
  });
});
