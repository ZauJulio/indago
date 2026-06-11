import { getRecipesData } from "@/content/queries";
import { CookingView } from "@/features/cooking";
import { toLocale } from "@/i18n";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const data = await getRecipesData({
    locale: toLocale(locale),
    q: sp.q,
    page: sp.page ? Number(sp.page) : undefined,
  });
  return <CookingView data={data} />;
}
