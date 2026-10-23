import { createFileRoute, redirect } from "@tanstack/react-router";

// The Campus page now lives inside Setup. Old links and bookmarks go there.
export const Route = createFileRoute("/campus")({
  beforeLoad: () => { throw redirect({ to: "/setup" }); },
});
