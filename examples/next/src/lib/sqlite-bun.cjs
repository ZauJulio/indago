// CJS shim that re-exports Bun's built-in SQLite, used by the webpack
// ContextReplacementPlugin in next.config.ts (reached only under the Bun runtime).
module.exports = require("bun:sqlite");
