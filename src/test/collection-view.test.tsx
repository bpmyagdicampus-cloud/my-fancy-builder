import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/lib/store", () => ({
  useTeacher: () => ({ data: { classes: [], plans: [{ id: "saved", title: "Saved plan", content: "Full teaching details" }] } }),
  updateData: update,
  uid: () => "new-id",
}));
vi.mock("@/components/app/ClassFields", () => ({ ClassPickField: () => null, DeptField: () => null }));
import { Collection } from "@/components/app/ui";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("Saved entry viewing", () => {
  const props = { k: "plans" as const, title: "Plans", fields: [{ k: "title", l: "Title" }, { k: "content", l: "Details" }], summary: (row: any) => row.title };
  it("opens full details without saving and preserves explicit editing", () => {
    render(<Collection {...props} />);
    fireEvent.click(screen.getByText("Saved plan"));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Full teaching details")).toBeVisible();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Edit · सम्पादन" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByDisplayValue("Full teaching details")).toBeVisible();
  });
  it("uses the custom lesson preview rather than opening an editor", () => {
    const onView = vi.fn();
    render(<Collection {...props} onView={onView} />);
    fireEvent.click(screen.getByText("Saved plan"));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: "saved" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});