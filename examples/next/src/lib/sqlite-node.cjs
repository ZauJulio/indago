// CJS shim that re-exports Node's built-in SQLite, used by the webpack
// ContextReplacementPlugin in next.config.ts (see the comment there).
module.exports = require("node:sqlite");
