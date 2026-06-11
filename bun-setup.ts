import { mock } from "bun:test";

mock.module("virtual:hyperdown-collections", () => ({
  collections: {
    articles: {
      getEntryBySlug: async (slug: string) => {
        if (slug === "building-a-som-from-scratch") {
          return {
            slug,
            data: {
              title: "ZSOM: A Production-Ready Self-Organizing Map in Pure NumPy",
              author: "Zau Julio",
            },
          };
        }
        return undefined;
      },
    },
  },
  getCollectionConfig: (name: string) => ({ name, dbUrl: ":memory:" }),
}));

mock.module("virtual:hyperdown-frontmatter", () => ({
  default: {},
  frontmatterConfig: {},
}));
