import { beforeEach, describe, expect, it, vi } from "vitest";
const { queries, rows } = vi.hoisted(() => ({ queries: [] as { table: string; filters: [string, unknown][] }[], rows: { current: [] as Record<string, unknown>[] } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const entry = { table, filters: [] as [string, unknown][] };
    queries.push(entry);
    const query = {
      select: () => query,
      eq: (k: string, value: unknown) => { entry.filters.push([k, value]); return query; },
      in: (k: string, value: unknown) => { entry.filters.push([k, value]); return query; },
      then: (resolve: (value: unknown) => unknown) => resolve({ error: null, data: table === "sqc_reports" ? rows.current.filter((r) => entry.filters.every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : r[k] === v)) : [] }),
    };
    return query;
  },
} }));
import { reportPayload } from "@/lib/sqc-data";
import { loadActionSummary } from "@/lib/dm";

beforeEach(() => { queries.length = 0; rows.current = [
  { id: "requested", teacher_id: "teacher-a", status: "Submitted", submit_for_request: true },
  { id: "ordinary", teacher_id: "teacher-a", status: "Submitted", submit_for_request: false },
  { id: "other-teacher", teacher_id: "teacher-b", status: "Under Review", submit_for_request: true },
  { id: "settled", teacher_id: "teacher-a", status: "Resolved", submit_for_request: true },
  { id: "legacy", teacher_id: "teacher-a", status: "Submitted", submit_for_request: null },
]; });
describe("SQC request delivery", () => {
  it("defaults new reports to no Home request and persists an explicit tick", () => {
    expect(reportPayload({ class_id: "class" }).submit_for_request).toBe(false);
    expect(reportPayload({ class_id: "class", submit_for_request: true }).submit_for_request).toBe(true);
  });
  it("does not rewrite legacy opt-in or legacy issue fields when unchanged", () => {
    const payload = reportPayload({ id: "legacy", class_id: "class", issues: "Learning", facilities: "Projector" });
    expect(payload).not.toHaveProperty("submit_for_request");
    expect(payload.issues).toBe("Learning");
    expect(payload.facilities).toBe("Projector");
  });
  it("shows only the concerned teacher's opted-in pending requests", async () => {
    expect((await loadActionSummary("teacher-a", false, [])).pendingSqcReports).toBe(1);
    expect(queries.find((q) => q.table === "sqc_reports")?.filters).toContainEqual(["teacher_id", "teacher-a"]);
  });
  it("shows administration all opted-in pending requests and excludes settled and ordinary reports", async () => {
    expect((await loadActionSummary("admin", true, [])).pendingSqcReports).toBe(2);
  });
});