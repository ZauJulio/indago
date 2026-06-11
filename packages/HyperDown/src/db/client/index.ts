import type { IHyperDownClient, SQLiteBindValue } from "./types.ts";

export type { SQLiteBindValue } from "./types.ts";

// SSR-only lazy client. The concrete `./ssr.ts` reaches Node built-ins, so it's
// NEVER statically imported here — only via a dynamic `import()` on first query
// (always server-side). This keeps it off the static graph, so a client bundle
// re-exporting `hyperDownClient` tree-shakes to nothing.

class HyperDownLazyClient implements IHyperDownClient {
  private _inner: IHyperDownClient | null = null;

  private async resolve(): Promise<IHyperDownClient> {
    if (this._inner) return this._inner;
    const { HyperDownSSRClient } = await import("./ssr.ts");
    this._inner = HyperDownSSRClient.getInstance();
    return this._inner;
  }

  async init(contentName?: string): Promise<string> {
    return (await this.resolve()).init(contentName);
  }

  async query<T>(sql: string, bind?: SQLiteBindValue[], contentName?: string): Promise<T[]> {
    return (await this.resolve()).query<T>(sql, bind, contentName);
  }
}

export const hyperDownClient: IHyperDownClient = new HyperDownLazyClient();
