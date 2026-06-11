import { defineConfig } from "vitest/config";

// Runs the standardized unit tests in __tests__ (content integrity). No DOM
// needed — these read the content tree and parse frontmatter.
export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
  },
});
