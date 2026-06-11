// Shim for HyperDown's Vite-only `virtual:hyperdown-collections` module (aliased
// in next.config.ts). The SSR client calls `getCollectionConfig(name)` to learn
// where a collection's `.db` lives; the prebuild copies each DB to
// `metadata/<name>.db`, which the client resolves from `process.cwd()`.
export async function getCollectionConfig(name: string): Promise<{ dbUrl: string }> {
  return { dbUrl: `/metadata/${name}.db` };
}
