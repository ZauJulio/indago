import * as p from "@clack/prompts";

import { HyperJsonCodegen } from "../../src/codegen.ts";
import { BaseCommand } from "./base-command.ts";

export class GenerateCommand extends BaseCommand {
  public async run(): Promise<void> {
    await this.executeSafely(async () => {
      const sp = p.spinner();
      sp.start("Generating TypeScript types from JSON schemas…");

      const codegen = new HyperJsonCodegen({ appRootDir: process.cwd() });
      await codegen.generate();

      sp.stop("Type generation complete");
    });
  }
}
