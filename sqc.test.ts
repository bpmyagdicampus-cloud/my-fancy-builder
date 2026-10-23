import { describe, it, expect } from "vitest";
import { filterReports, lateMinutes, monthRange, summarize, validateReport, type Period, type Report, type SqcClass } from "@/lib/sqc";

const classes: SqcClass[] = [{ id: "c1", name: "BBS I", section: "A" }, { id: "c2", name: "BBS II", section: "" }];
const periods: Period[] = [{ period_no: 1, start_time: "07:00:00", end_time: "07:45:00" }, { period_no: 2, start_time: "07:45:00", end_time: "08:30:00" }];
const rep = (o: Partial<Report>): Report => ({ id: "r", class_id: "c1", report_date: "2083-05-04", period_no: 1, teacher_id: "t1", teacher_name: "Ram", subject: "Acc", held: true, arrival_time: "07:10:00", departure_time: "07:45:00", not_held_reason: "", present_count: 20, total_count: 25, issues: "", facilities: "", requests: "", suggestions: "", status: "Submitted", submitted_by_name: "CR", submitted_at: "", year_name: "2083/84", ...o });

describe("SQC logic", () => {
  it("validates like the database does", () => {
    const ok = { class_id: "c1", report_date: "2083-05-04", period_no: 1, teacher_id: "t1", held: true, arrival_time: "07:10" };
    expect(validateReport(ok)).toBeNull();
    expect(validateReport({ ...ok, class_id: "" })).toMatch(/class/);
    expect(validateReport({ ...ok, period_no: 13 })).toMatch(/period/i);
    expect(validateReport({ ...ok, arrival_time: undefined })).toMatch(/arrival/);
    expect(validateReport({ ...ok, departure_time: "07:00" })).toMatch(/after/);
    expect(validateReport({ ...ok, held: false })).toMatch(/reason/);
    expect(validateReport({ ...ok, present_count: 30, total_count: 25 })).toMatch(/more than/);
  });
  it("computes lateness and ignores classes not held", () => {
    expect(lateMinutes(rep({}), periods)).toBe(10);
    expect(lateMinutes(rep({ held: false }), periods)).toBeNull();
    expect(lateMinutes(rep({ period_no: 7 }), periods)).toBeNull();
  });
  it("filters by class, teacher, date range, period, status and text", () => {
    const rows = [rep({ id: "1" }), rep({ id: "2", class_id: "c2", report_date: "2083-06-02", period_no: 2, teacher_id: "t2", teacher_name: "Sita", status: "Resolved", issues: "Projector broken" })];
    expect(filterReports(rows, { classId: "c2" }, classes).map((r) => r.id)).toEqual(["2"]);
    expect(filterReports(rows, { ...monthRange("2083-05") }, classes).map((r) => r.id)).toEqual(["1"]);
    expect(filterReports(rows, { status: "Resolved" }, classes)).toHaveLength(1);
    expect(filterReports(rows, { q: "projector" }, classes)).toHaveLength(1);
    expect(filterReports(rows, { teacherId: "t1", period: 1 }, classes)).toHaveLength(1);
    expect(filterReports(rows, {}, classes).map((r) => r.id)).toEqual(["2", "1"]);
  });
  it("summarises per class and per teacher", () => {
    const rows = [rep({ id: "1" }), rep({ id: "2", held: false, arrival_time: null, departure_time: null, not_held_reason: "Strike", issues: "x" }), rep({ id: "3", class_id: "c2", status: "Resolved", arrival_time: "07:00:00" })];
    const s = summarize(rows, periods, classes);
    expect(s.total).toBe(3); expect(s.held).toBe(2); expect(s.notHeld).toBe(1);
    expect(s.late).toBe(1); expect(s.byStatus.Resolved).toBe(1); expect(s.withIssues).toBe(1);
    expect(s.byClass.map((r) => [r.name, r.reports])).toEqual([["BBS I (A)", 2], ["BBS II", 1]]);
    expect(s.byTeacher[0]!.reports).toBe(3);
    expect(s.avgLate).toBe(5);
  });
});
