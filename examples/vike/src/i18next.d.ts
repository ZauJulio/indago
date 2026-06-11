import "i18next";
import type en from "./i18n/locales/en.json";

// Enable i18next's type-safe selector API (`t(($) => $.a.b)`) and bind the
// resource shape so keys autocomplete. `en` is the source-of-truth locale; the
// single `translation` namespace mirrors the runtime `resources` in `i18n.ts`.
declare module "i18next" {
  interface CustomTypeOptions {
    enableSelector: true;
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
