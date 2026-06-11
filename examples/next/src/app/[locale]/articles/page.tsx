import { getArticlesData } from "@/content/queries";
import { ArticlesView } from "@/features/articles";
import { toLocale } from "@/i18n";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const data = await getArticlesData({
    locale: toLocale(locale),
    q: sp.q,
    tag: sp.tag,
    page: sp.page ? Number(sp.page) : undefined,
  });
  return <ArticlesView data={data} />;
}
