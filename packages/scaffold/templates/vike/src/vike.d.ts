import "vike/types";
import type { Locale } from "@/i18n";

// Augment Vike's PageContext with the i18n fields set by +onBeforeRoute and
// passed to the client via `passToClient` in +config.ts.
declare global {
  namespace Vike {
    interface PageContext {
      locale: Locale;
      /** Canonical BCP-47 / DB / `hreflang` tag for the active locale (`en` / `pt-BR`). */
      localeCan: string;
      /** `Intl` display tag for the active locale (`en-US` / `pt-BR`). */
      displayLocale: "en-US" | "pt-BR";
      urlLogical?: string;
      /** The real, locale-prefixed request path (e.g. `/pt/cooking`). */
      urlPathnameLocalized: string;
    }
  }
}
