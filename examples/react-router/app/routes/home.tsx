import { useTranslation } from "react-i18next";

import { Link } from "@/components/Link";

export default function Home() {
  const { t } = useTranslation();

  const sections = [
    { to: "/articles", label: t(($) => $.nav.articles), desc: t(($) => $.articles.description) },
    { to: "/cooking", label: t(($) => $.nav.cooking), desc: t(($) => $.recipes.description) },
    { to: "/projects", label: t(($) => $.nav.projects), desc: t(($) => $.projects.description) },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-24">
      <h1 className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-5xl font-bold text-transparent">
        {t(($) => $.home.title)}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-zinc-400">{t(($) => $.home.subtitle)}</p>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 no-underline transition-colors hover:border-brand-500"
          >
            <span className="text-lg font-semibold text-white">{s.label}</span>
            <span className="mt-2 block text-sm text-zinc-400">{s.desc}</span>
            <span className="mt-3 inline-block text-sm text-brand-400">
              {t(($) => $.home.explore)} →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
