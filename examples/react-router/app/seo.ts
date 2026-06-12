// SEO helpers producing React Router `meta` descriptors.

export const SITE_NAME = "create-muttum-app";
export const SITE_DESCRIPTION = "HyperDown + HyperJson starter (React Router).";

type MetaDescriptor =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

/** Site-wide Open Graph / Twitter defaults (root route `meta`). */
export function siteMeta(): MetaDescriptor[] {
  return [
    { title: SITE_NAME },
    { name: "description", content: SITE_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: SITE_NAME },
    { property: "og:description", content: SITE_DESCRIPTION },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: SITE_NAME },
    { name: "twitter:description", content: SITE_DESCRIPTION },
  ];
}

/** Per-resource Open Graph / Twitter tags for a content detail route. */
export function contentMeta(opts: {
  title?: string;
  description?: string;
  cover?: string;
  type?: string;
}): MetaDescriptor[] {
  if (!opts.title) return [{ title: SITE_NAME }];
  const { title, description, cover, type = "article" } = opts;
  const tags: MetaDescriptor[] = [
    { title: `${title} | ${SITE_NAME}` },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
  ];
  if (description) {
    tags.push(
      { name: "description", content: description },
      { property: "og:description", content: description },
      { name: "twitter:description", content: description },
    );
  }
  if (cover) {
    tags.push({ property: "og:image", content: cover }, { name: "twitter:image", content: cover });
  }
  return tags;
}
