import "server-only";

// Server-only re-export of the generated lazy repositories. `server-only`
// guarantees a build error if this is ever imported into a Client Component.
export { articleRepository } from "@hyper-down/content/article/builder";
export { recipeRepository } from "@hyper-down/content/recipe/builder";
