import { usePageContext } from "vike-react/usePageContext";

import { ContentHead } from "@/components/ContentHead";

import type { Data } from "./+data";

/** Per-article Open Graph / Twitter tags (https://vike.dev/Head). */
export default function Head() {
  const article = usePageContext().data as Data | undefined;
  return (
    <ContentHead title={article?.title} description={article?.description} cover={article?.cover} />
  );
}
