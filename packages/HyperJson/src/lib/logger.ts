import pino from "pino";

const isNode = typeof process !== "undefined" && !!process.stdout;
import type { Writable } from "node:stream";

let prettyStream: Writable | undefined;
if (isNode) {
  try {
    const mod = await import("pino-pretty");
    prettyStream = mod.default({ colorize: true }) as Writable;
  } catch {
    // pino-pretty not available — fall back to JSON output
  }
}

const root = pino(
  {
    level: isNode ? process.env.LOG_LEVEL || "info" : "info",
    ...(!isNode ? { browser: { asObject: true } } : {}),
  },
  prettyStream,
);

/** JSON schema validation (compile, validate files) */
export const validateLog = root.child({ name: "HyperJson: 📋 validate" });

/** Vite plugin lifecycle */
export const pluginLog = root.child({ name: "HyperJson: 🔌 plugin" });

/** Codegen script (type generation from schemas) */
export const codegenLog = root.child({ name: "HyperJson: ⚙️  codegen" });

export const log = root;

export default root;
