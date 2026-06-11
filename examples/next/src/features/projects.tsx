"use client";

import { useTranslation } from "react-i18next";

import projectsJson from "@content/projects/en/projects.json";

import { Link } from "@/components/Link";

// HyperJson validates this file against content/projects/schema.json in the
// prebuild; `resolveJsonModule` types the import here.
const projects = projectsJson.projects;

export function ProjectsView() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <Link to="/" className="text-sm text-brand-400 no-underline">
        ← {t(($) => $.common.home)}
      </Link>

      <h1 className="mt-4 text-4xl font-bold text-white">{t(($) => $.projects.title)}</h1>
      <p className="mt-3 max-w-2xl text-zinc-400">{t(($) => $.projects.description)}</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <a
            key={project.name}
            data-testid="project-card"
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 no-underline transition-colors hover:border-brand-500"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{project.name}</h2>
              <span className="text-xs text-zinc-500">
                ★ {project.stars} {t(($) => $.projects.stars)}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">{project.description}</p>
            <span
              className="mt-3 inline-flex items-center gap-1.5 text-xs"
              style={{ color: project.languageColor }}
            >
              ● {project.language}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
