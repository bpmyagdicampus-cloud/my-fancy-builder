import { describe, expect, it, vi } from "vitest";
import { confirmEditedSave } from "@/components/app/editing";
describe("Edited record confirmation", () => {
  it("blocks edited saves when Cancel is chosen", () => {
    const prompt = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(confirmEditedSave("saved-id")).toBe(false);
    prompt.mockRestore();
  });
  it("allows edited saves only after OK", () => {
    const prompt = vi.spyOn(window, "confirm").mockReturnValue(true);
    expect(confirmEditedSave("saved-id")).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    prompt.mockRestore();
  });
});