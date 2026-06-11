import { createFileRoute } from "@tanstack/react-router";

import { HomeView } from "@/features/home";

// Optional `{-$locale}` path param (https://tanstack.com/router/latest/docs/guide/internationalization-i18n):
// one route tree serves both `/` (default locale, prefix-free) and `/pt`.
export const Route = createFileRoute("/{-$locale}/")({
  component: HomeView,
});
