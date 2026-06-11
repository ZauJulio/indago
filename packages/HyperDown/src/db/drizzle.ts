import { drizzle } from "drizzle-orm/sqlite-proxy";

import { sqliteLog } from "../utils/logger.server.ts";
import { hyperDownClient, type SQLiteBindValue } from "./client/index.ts";

export const getDrizzleDb = async (contentName?: string) => {
  await hyperDownClient.init(contentName);

  return drizzle(async (sql, params, method) => {
    try {
      const rows = await hyperDownClient.query(sql, params as SQLiteBindValue[], contentName);
      if (method === "run") return { rows: [] };
      return { rows };
    } catch (e) {
      // Log and rethrow — swallowing would make a broken query look like an
      // empty result; the loader decides how to handle it.
      sqliteLog.error({ err: e }, "Drizzle run error");
      throw e instanceof Error ? e : new Error(String(e));
    }
  });
};
