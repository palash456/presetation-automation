"use client";

import { useMemo } from "react";
import { Eye, Plus, Search, X } from "lucide-react";
import type { SlideTemplateDefinition } from "./types";
import { SlideLayoutThumb } from "./template-slide-thumbnail";

const USE_CASE_FILTERS = ["all", "Title", "Content", "Comparison", "Data", "Agenda", "Closing"] as const;

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function StatusPill({ status }: { status: SlideTemplateDefinition["status"] }) {
  const isOk = status === "processed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        isOk
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-400",
      )}
    >
      {isOk ? "Processed" : "Needs review"}
    </span>
  );
}

export type TemplateSelectGalleryProps = {
  templates: SlideTemplateDefinition[];
  filtered: SlideTemplateDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterUseCase: (typeof USE_CASE_FILTERS)[number];
  onFilterUseCase: (v: (typeof USE_CASE_FILTERS)[number]) => void;
  filterStatus: "all" | SlideTemplateDefinition["status"];
  onFilterStatus: (v: "all" | SlideTemplateDefinition["status"]) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onCustomize: () => void;
  onQuickPreview: (id: string) => void;
  onCreateImport: () => void;
};

export function TemplateSelectGallery({
  templates,
  filtered,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  filterUseCase,
  onFilterUseCase,
  filterStatus,
  onFilterStatus,
  panelOpen,
  onPanelOpenChange,
  onCustomize,
  onQuickPreview,
  onCreateImport,
}: TemplateSelectGalleryProps) {
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[var(--background)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <header className="max-w-xl">
            <h1 className="text-2xl font-semibold tracking-tight">
              Choose a Template to Customize
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Pick a layout slide first, then edit regions, limits, and
              metadata in the same editor you already use.
            </p>
          </header>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative min-w-[min(100%,320px)] flex-1 max-w-xl">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search by name, type, or tag…"
                aria-label="Search templates"
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] pl-10 pr-4 text-sm text-foreground placeholder:text-[var(--muted)] transition-shadow focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filterUseCase}
                onChange={(e) =>
                  onFilterUseCase(
                    e.target.value as (typeof USE_CASE_FILTERS)[number],
                  )
                }
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                aria-label="Filter by use case"
              >
                {USE_CASE_FILTERS.map((u) => (
                  <option key={u} value={u}>
                    {u === "all" ? "All use cases" : u}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) =>
                  onFilterStatus(
                    e.target.value as typeof filterStatus,
                  )
                }
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="processed">Processed</option>
                <option value="needs_review">Needs review</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-12 flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-16 text-center">
              <p className="text-lg font-semibold tracking-tight text-foreground">
                No templates match
              </p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
                Try a different search or filter, or add a template with Create
                / Import.
              </p>
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <li>
                <button
                  type="button"
                  onClick={onCreateImport}
                  className="group flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 text-center transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--surface-inset)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent-muted)]">
                    <Plus className="size-6 stroke-[1.75]" />
                  </span>
                  <span className="font-semibold tracking-tight">
                    Create / Import Template
                  </span>
                  <span className="max-w-[200px] text-sm text-[var(--muted)]">
                    Upload JSON or start from a new definition in customize
                    mode.
                  </span>
                </button>
              </li>
              {filtered.map((t) => (
                <li key={t.id}>
                  <div
                    className={cn(
                      "group relative flex flex-col rounded-2xl border bg-[var(--surface-raised)] p-5 transition-colors",
                      t.id === selectedId
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/30"
                        : "border-[var(--border-subtle)] hover:border-[var(--accent)]/30 hover:bg-[var(--background)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(t.id);
                        onPanelOpenChange(true);
                      }}
                      className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      aria-label={`Select ${t.name}`}
                    />
                    <div className="pointer-events-none relative z-[1] flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-inset)]">
                      <SlideLayoutThumb slide={t} />
                    </div>
                    <div className="pointer-events-none relative z-[1] mt-4 flex items-start justify-between gap-3">
                      <h2 className="text-left font-semibold leading-snug tracking-tight">
                        {t.name}
                      </h2>
                    </div>
                    <div className="pointer-events-none relative z-[1] mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                        {t.useCase}
                      </span>
                      <StatusPill status={t.status} />
                      {t.designTags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="relative z-[2] mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(t.id);
                          onCustomize();
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-3 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
                      >
                        Customize Template
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickPreview(t.id);
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        <Eye className="mr-1.5 size-3.5" strokeWidth={2} />
                        Quick Preview
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {panelOpen && (
        <button
          type="button"
          aria-label="Close details panel"
          className="fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden"
          onClick={() => onPanelOpenChange(false)}
        />
      )}

      <aside
        className={cn(
          "export-panel-enter fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--foreground)] shadow-2xl transition-transform duration-300 ease-out",
          panelOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
        aria-hidden={!panelOpen}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight">
            Template details
          </h2>
          <button
            type="button"
            onClick={() => onPanelOpenChange(false)}
            className="flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Close panel"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto p-5">
          {selected ? (
            <>
              <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)]">
                <div className="aspect-video w-full">
                  <SlideLayoutThumb slide={selected} />
                </div>
              </div>
              <p className="mt-4 text-lg font-semibold tracking-tight">
                {selected.name}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {selected.templateType} · {selected.layoutRule} layout
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium">
                  {selected.useCase}
                </span>
                <StatusPill status={selected.status} />
                {selected.designTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
                {selected.regions.length} regions · density{" "}
                <span className="font-medium text-foreground">
                  {selected.density}
                </span>
              </p>
              <div className="mt-6 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    onCustomize();
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
                >
                  Customize Template
                </button>
                <button
                  type="button"
                  onClick={() => onQuickPreview(selected.id)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] text-sm font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Eye className="size-4" strokeWidth={2} />
                  Quick Preview
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Select a template from the grid to see details.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
