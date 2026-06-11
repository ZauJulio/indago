import { SITE_NAME } from "@/seo";

interface ContentHeadProps {
  title?: string;
  description?: string;
  cover?: string;
  type?: "article" | "website";
}

/** Per-resource Open Graph / Twitter tags for a content detail page. */
export function ContentHead({ title, description, cover, type = "article" }: ContentHeadProps) {
  if (!title) return null;
  return (
    <>
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {cover && <meta property="og:image" content={cover} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {cover && <meta name="twitter:image" content={cover} />}
    </>
  );
}
