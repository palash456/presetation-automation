"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitCompare } from "lucide-react";
import type { PresentationHistory } from "./types";
import { formatDateTime, formatRelative } from "./format-date";
import { StatusPill } from "./status-pill";

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

export function ProjectTimeline({ project }: { project: PresentationHistory }) {
  const [selectedCompare, setSelectedCompare] = useState<string[]>([]);

  const toggleCompare = (versionId: string) => {
    setSelectedCompare((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1]!, versionId];
      }
      return [...prev, versionId];
    });
  };

  const canCompare = selectedCompare.length === 2;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8 sm:py-10">
      <Link
        href="/history"
        className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        All presentations
      </Link>

      <header className="mt-8 border-b border-[var(--border-subtle)] pb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          <span>Last edited {formatRelative(project.lastEdited)}</span>
          <span className="text-[var(--border-subtle)]">·</span>
          <StatusPill status={project.status} />
          <span className="text-[var(--border-subtle)]">·</span>
          <span>{project.versionCount} versions total</span>
        </div>
      </header>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Version timeline</h2>
          <p className="text-xs text-[var(--muted)]">
            Select two versions to compare (preview coming soon).
          </p>
        </div>

        {canCompare && (
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90"
            onClick={() => {
              /* Roadmap: open diff view */
            }}
          >
            <GitCompare className="size-3.5" />
            Compare selected
          </button>
        )}

        <ol className="mt-8">
          {project.versions.map((v, i) => {
            const isLatest = i === 0;
            const isCompareSelected = selectedCompare.includes(v.id);
            const isLast = i === project.versions.length - 1;
            return (
              <li key={v.id} className="flex gap-4 pb-10 last:pb-0">
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <span
                    className={cn(
                      "z-10 size-3 shrink-0 rounded-full border-2 border-[var(--background)]",
                      isLatest
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--surface-inset)]",
                    )}
                  />
                  {!isLast && (
                    <span
                      className="mt-1 w-px flex-1 min-h-[2.5rem] bg-[var(--border-subtle)]"
                      aria-hidden
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-xl border p-4 transition-colors",
                    isCompareSelected
                      ? "border-[var(--accent)]/40 bg-[var(--accent-muted)]/50"
                      : "border-[var(--border-subtle)] bg-[var(--surface-raised)]",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {v.label}
                        </span>
                        {isLatest && (
                          <span className="rounded-md bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {formatDateTime(v.savedAt)} · {v.author}
                      </p>
                      {v.summary && (
                        <p className="mt-2 text-sm leading-relaxed">{v.summary}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)]"
                        onClick={() => {
                          /* UI only */
                        }}
                      >
                        Restore
                      </button>
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
                        <input
                          type="checkbox"
                          checked={isCompareSelected}
                          onChange={() => toggleCompare(v.id)}
                          className="rounded border-[var(--border-subtle)]"
                        />
                        Compare
                      </label>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
