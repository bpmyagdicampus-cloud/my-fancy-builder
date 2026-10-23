import { describe, it, expect } from "vitest";
import { normalizeData } from "@/lib/migrate";
import { addStudents, classStudents, moveStudents, renameStudent } from "@/lib/students";
import { nextYearName, startYear, switchYear, snapshot, upgradeSubject } from "@/lib/years";

const base = () => normalizeData({
  classes: [{ id: "c1", name: "BBS I", subject: "A", code: "", totalLh: 10, students: "Ram\nSita" }, { id: "c2", name: "BBS II", subject: "B", code: "", totalLh: 10, students: "" }],
  diary: [{ id: "d1", classId: "c1", date: "2083-05-04", absent: ["Ram"] }],
  assess: [{ id: "a1", classId: "c1", date: "2083-05-10", marks: { Ram: { m: "5", c: "" } } }],
});

describe("phase 3 — students and academic years", () => {
  it("builds the registry from old text lists without changing names", () => {
    const d = base();
    expect(d.students.map((s) => s.name)).toEqual(["Ram", "Sita"]);
    expect(d.classes[0]!.students).toBe("Ram\nSita");
    expect(d.years).toHaveLength(1);
  });
  it("renames a student everywhere in this year and blocks duplicates", () => {
    const d = base();
    const ram = d.students.find((s) => s.name === "Ram")!;
    expect(renameStudent(d, ram.id, "Ramesh")).toBeNull();
    expect(d.diary[0]!.absent).toEqual(["Ramesh"]);
    expect(Object.keys(d.assess[0]!.marks)).toEqual(["Ramesh"]);
    expect(renameStudent(d, ram.id, "sita")).toMatch(/already/);
    expect(addStudents(d, "c1", ["Sita", "Gita"]).skipped).toEqual(["Sita"]);
  });
  it("moving a student keeps old attendance with the old class", () => {
    const d = base();
    const ram = d.students.find((s) => s.name === "Ram")!;
    moveStudents(d, [ram.id], "c2");
    expect(classStudents(d, "c2").map((s) => s.name)).toEqual(["Ram"]);
    expect(d.diary[0]!.classId).toBe("c1");
    expect(d.diary[0]!.absent).toEqual(["Ram"]);
  });
  it("starting a year archives the old one, and switching back restores it exactly", () => {
    const d = base();
    const y0 = d.settings.yearId, before = JSON.stringify(snapshot(d));
    expect(startYear(d, { name: nextYearName(d.years[0]!.name), rows: d.classes.map((c) => ({ classId: c.id, carry: true, newName: c.name, students: true })), units: true, calendar: false, lessons: false })).toBeNull();
    expect(d.diary).toHaveLength(0);
    expect(d.classes.every((c) => c.pending)).toBe(true);
    expect(d.students.map((s) => s.name).sort()).toEqual(["Ram", "Sita"]);
    expect(switchYear(d, y0)).toBeNull();
    expect(JSON.stringify(snapshot(d))).toBe(before);
  });
  it("upgrading a subject closes the old class and moves students", () => {
    const d = base();
    expect(upgradeSubject(d, "c1", { subject: "New", code: "N1", totalLh: 20, name: "BBS I" })).toBeNull();
    expect(d.classes[0]!.closed).toBe(true);
    const nc = d.classes[d.classes.length - 1]!;
    expect(classStudents(d, nc.id)).toHaveLength(2);
    expect(d.classes[0]!.students).toBe("Ram\nSita");
  });
  it("names the next year", () => {
    expect(nextYearName("2083/84")).toBe("2084/85");
    expect(nextYearName("2099/00")).toBe("2100/01");
  });
});
