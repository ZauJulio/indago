import * as p from "@clack/prompts";

export abstract class BaseCommand {
  protected async executeSafely(fn: () => Promise<void> | void): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred.";
      p.log.error(msg);
      process.exit(1);
    }
  }
}
