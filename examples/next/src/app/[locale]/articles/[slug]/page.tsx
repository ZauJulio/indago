import { getArticleData } from "@/content/queries";
import { ArticleView } from "@/features/article";
import { toLocale } from "@/i18n";
import { contentMetadata } from "@/seo";

import type { Metadata } from "next";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { article } = await getArticleData({ locale: toLocale(locale), slug });
  return contentMetadata(article ?? {});
}

export default async function Page({ params }: PageProps) {
  const { locale, slug } = await params;
  const data = await getArticleData({ locale: toLocale(locale), slug });
  return <ArticleView data={data} />;
}
