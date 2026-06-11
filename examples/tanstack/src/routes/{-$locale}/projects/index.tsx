import { createFileRoute } from "@tanstack/react-router";

import { ProjectsView } from "@/features/projects";

export const Route = createFileRoute("/{-$locale}/projects/")({
  component: ProjectsView,
});
