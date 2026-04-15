import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PresentationHistory } from "./types";
import { formatRelative } from "./format-date";
import { StatusPill } from "./status-pill";

export function HistoryProjectCards({
  projects,
}: {
  projects: PresentationHistory[];
}) {
  if (projects.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/history/${p.id}`}
            className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 transition-colors hover:border-[var(--accent)]/30 hover:bg-[var(--background)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold leading-snug tracking-tight group-hover:text-[var(--accent)]">
                {p.name}
              </h2>
              <ChevronRight className="size-5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Last edited {formatRelative(p.lastEdited)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill status={p.status} />
              <span className="text-xs text-[var(--muted)]">
                {p.versionCount} versions
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
