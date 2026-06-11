#!/usr/bin/env bun

import { validateLog } from "../src/lib/logger.ts";
import { resolveDefaultContentDir, validateContentSchemas } from "../src/lib/validate.ts";

const contentDir = process.argv[2] || resolveDefaultContentDir();
const { passed, failed } = validateContentSchemas(contentDir);

if (failed === 0) {
  validateLog.info(`All ${passed} JSON files validated successfully.`);
} else {
  validateLog.error({ passed, failed }, `${failed}/${passed + failed} files FAILED validation.`);
  process.exit(1);
}
