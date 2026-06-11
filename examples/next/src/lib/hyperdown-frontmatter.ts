// Shim for HyperDown's Vite-only `virtual:hyperdown-frontmatter` module (aliased
// in next.config.ts). The engine reads the frontmatter config from it to build
// the locale map (en / pt-BR). We point it at the app's real frontmatter.json.
import frontmatter from "../../frontmatter.json";

export default frontmatter;
