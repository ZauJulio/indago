import { usePageContext } from "vike-react/usePageContext";

import { ContentHead } from "@/components/ContentHead";

import type { Data } from "./+data";

/** Per-recipe Open Graph / Twitter tags (https://vike.dev/Head). */
export default function Head() {
  const recipe = usePageContext().data as Data | undefined;
  return (
    <ContentHead title={recipe?.title} description={recipe?.description} cover={recipe?.cover} />
  );
}
