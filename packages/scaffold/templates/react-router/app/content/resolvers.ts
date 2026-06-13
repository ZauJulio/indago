import { contentModules } from "@hyper-down/default";
import { createContentResolver } from "@indago/hyper-down";

// Browser-safe resolvers: turn a (slug, lang) pair into the lazy MDX component.
export const getArticleContent = createContentResolver(contentModules["article"]);
export const getRecipeContent = createContentResolver(contentModules["recipe"]);
