import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { deleteUnsaved, downloadUnsaved, listUnsaved } from "@/lib/cloud";
import { weekday } from "@/lib/bs";

describe("build regression helpers", () => {
  beforeEach(() => localStorage.clear());

  it("keeps recovery copies inaccessible without their signed-in owner", () => {
    const key = "shikshak-cloud-unsaved-teacher-1-1792418400000";
    localStorage.setItem(key, JSON.stringify({ data: { diary: [{ id: "entry-1" }] } }));
    expect(listUnsaved(null)).toEqual([]);
    expect(listUnsaved("teacher-1")).toEqual([]);
    downloadUnsaved(key);
    deleteUnsaved(key);
    expect(JSON.parse(localStorage.getItem(key) ?? "{}").data.diary).toEqual([{ id: "entry-1" }]);
  });

  it("returns a defined weekday for the known BS conversion", () => {
    expect(weekday("2083-04-01")).toBe("Fri");
  });
});