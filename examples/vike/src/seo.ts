// Site-wide SEO constants. Override `SITE_URL` per environment with the
// `VITE_SITE_URL` env var so canonical/Open Graph URLs are absolute in prod.

export const SITE_NAME = "create-muttum-app";
export const SITE_DESCRIPTION = "HyperDown + HyperJson starter (Vike).";
export const SITE_URL = (import.meta.env as Record<string, string | undefined>).VITE_SITE_URL ?? "";
