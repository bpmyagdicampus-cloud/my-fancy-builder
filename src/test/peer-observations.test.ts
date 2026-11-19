import { beforeEach, describe, expect, it, vi } from "vitest";
const { cloud, saved, upsert } = vi.hoisted(() => ({ cloud: { userId: "observer" as string | null }, saved: [] as any[], upsert: vi.fn() }));
vi.mock("@/lib/cloud", () => ({ getCloudState: () => cloud }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({
  upsert: async (value: any, options: any) => { upsert(value, options); for (const row of Array.isArray(value) ? value : [value]) { const i = saved.findIndex((r) => r.id === row.id); if (i < 0) saved.push(row); else if (!options?.ignoreDuplicates) saved[i] = row; } return { error: null }; },
  select: () => ({ eq: (column: string, id: string) => ({ order: async () => ({ data: saved.filter((r) => r[column] === id), error: null }) }) }),
}) } }));
import { getObservationsByObserver, getObservationsForTeacher, savePeerObservation, type PeerObservation } from "@/lib/peer-obs";
const observation = { id: "peer", teacherId: "teacher", teacherName: "Teacher", observerId: "observer", observerName: "Observer", topic: "Accounting", totalScore: 40 } as PeerObservation;
beforeEach(() => { saved.length = 0; upsert.mockClear(); localStorage.clear(); cloud.userId = "observer"; });
describe("Shared peer observations", () => {
  it("reads the same saved observation back for observer and observed teacher", async () => {
    await savePeerObservation(observation);
    expect((await getObservationsByObserver("Observer", "observer"))[0]?.topic).toBe("Accounting");
    cloud.userId = "teacher";
    expect((await getObservationsForTeacher("Teacher", "teacher"))[0]?.id).toBe("peer");
    expect(await getObservationsForTeacher("Teacher", "unrelated")).toEqual([]);
  });
  it("copies linked legacy observations without erasing local originals or overwriting shared records", async () => {
    localStorage.setItem("shikshak-peer-observations-v1", JSON.stringify([observation]));
    saved.push({ id: "peer", observer_id: "observer", teacher_id: "teacher", content: { ...observation, teacherAck: "Received" } });
    const result = await getObservationsByObserver("Observer", "observer");
    expect(result[0]?.teacherAck).toBe("Received");
    expect(JSON.parse(localStorage.getItem("shikshak-peer-observations-v1") || "[]")).toHaveLength(1);
    expect(upsert).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ ignoreDuplicates: true }));
  });
});