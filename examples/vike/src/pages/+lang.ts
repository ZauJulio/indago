import { I18N } from "@/i18n";

import type { PageContext } from "vike/types";

// Per-locale `<html lang>` (region-qualified BCP-47 tag, e.g. `pt-BR`): the
// canonical tag already derived by +onBeforeRoute and exposed as `localeCan`.
// Must be its own +lang file — Vike forbids runtime functions in +config.ts.
// https://vike.dev/lang
export default function lang(pageContext: PageContext): string {
  return pageContext.localeCan ?? I18N.locales[I18N.defaultLocale].canonical;
}
