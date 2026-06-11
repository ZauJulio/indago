// Server-only re-export of the generated lazy repositories. The `.server.ts`
// suffix guarantees React Router strips this (and its SQLite client) from the
// browser bundle, even though loaders + components live in the same route file.
export { articleRepository } from "@hyper-down/content/article/builder";
export { recipeRepository } from "@hyper-down/content/recipe/builder";
