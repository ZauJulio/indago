import type { Metadata } from "next";

export const SITE_NAME = "@indago/create-app";
export const SITE_DESCRIPTION = "HyperDown + HyperJson starter (Next.js).";

/** Base site metadata applied by the root layout. */
export const siteMetadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

/** Per-resource metadata for a content detail page (`generateMetadata`). */
export function contentMetadata(opts: {
  title?: string;
  description?: string;
  cover?: string;
  type?: "article" | "website";
}): Metadata {
  if (!opts.title) return {};
  const { title, description, cover, type = "article" } = opts;
  const images = cover ? [cover] : undefined;

  return {
    title,
    description,
    openGraph: { type, siteName: SITE_NAME, title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
