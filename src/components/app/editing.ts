import { useEffect, useRef } from "react";

export const confirmEditedSave = (editing: unknown) => !editing || window.confirm("के तपाईं सच्याइएको विवरण सुरक्षित गर्न चाहनुहुन्छ? (Save changes?)");

/** Scroll the actual edit surface, including within the desktop content scroller. */
export function useEditScroll(active: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const key = active && typeof active === "object" && "id" in active ? String(active.id || "new") : Boolean(active);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => ref.current?.scrollIntoView({ block: "start", behavior: "instant" }), 80);
    return () => window.clearTimeout(timer);
  }, [key]);
  return ref;
}