import { type RouteConfig, index, prefix, route } from "@react-router/dev/routes";

// Standardized routes. The default locale is served prefix-free; the same route
// modules are mounted again under `/pt` (with unique ids) so one component tree
// serves both languages. Each loader derives the locale from the request URL.
const localized = [
  route("articles", "routes/articles.tsx"),
  route("articles/:slug", "routes/article.tsx"),
  route("cooking", "routes/cooking.tsx"),
  route("cooking/:slug", "routes/recipe.tsx"),
  route("projects", "routes/projects.tsx"),
];

export default [
  index("routes/home.tsx"),
  ...localized,
  ...prefix("pt", [
    index("routes/home.tsx", { id: "pt-home" }),
    route("articles", "routes/articles.tsx", { id: "pt-articles" }),
    route("articles/:slug", "routes/article.tsx", { id: "pt-article" }),
    route("cooking", "routes/cooking.tsx", { id: "pt-cooking" }),
    route("cooking/:slug", "routes/recipe.tsx", { id: "pt-recipe" }),
    route("projects", "routes/projects.tsx", { id: "pt-projects" }),
  ]),
] satisfies RouteConfig;
