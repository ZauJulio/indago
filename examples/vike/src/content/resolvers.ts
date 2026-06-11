import { contentModules } from "@hyper-down/default";
import { createContentResolver } from "@virtus/hyper-down";

// Browser-safe resolvers that turn a (slug, lang) pair into the lazy MDX
// component. They touch no DB code, so route components can import them.
export const getArticleContent = createContentResolver(contentModules["article"]);
export const getRecipeContent = createContentResolver(contentModules["recipe"]);
