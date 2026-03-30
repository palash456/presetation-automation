"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Palette,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import type { AddTemplateSource } from "./add-template-source";
import { ADD_TEMPLATE_OPTIONS } from "./add-template-options";
import type { CompanyTemplate } from "./company-types";
import type { SlideTemplateDefinition } from "./types";
import { SlideLayoutThumb } from "./template-slide-thumbnail";

export type { AddTemplateSource } from "./add-template-source";

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function CompanySlideStrip({
  slides,
  variant = "grid",
}: {
  slides: SlideTemplateDefinition[];
  /** `hero`: one 16×9 preview (library cards). `grid`: up to four thumbs (create flow + panel). */
  variant?: "grid" | "hero";
}) {
  const preview = slides.slice(0, 4);
  if (preview.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)] text-center text-xs text-[var(--muted)]">
        No slides in this pack
      </div>
    );
  }
  if (variant === "hero") {
    const first = preview[0]!;
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-[var(--surface-inset)]">
        <SlideLayoutThumb slide={first} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {preview.map((t) => (
        <div
          key={t.id}
          className="aspect-video overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)]"
        >
          <SlideLayoutThumb slide={t} />
        </div>
      ))}
    </div>
  );
}

export const COMPANY_INDUSTRY_FILTERS = [
  "all",
  "Technology",
  "General",
  "Consulting",
  "Healthcare",
  "Finance",
] as const;

export const COMPANY_STYLE_FILTERS = [
  "all",
  "Corporate",
  "Creative",
  "Minimal",
] as const;

export const COMPANY_USE_CASE_FILTERS = [
  "all",
  "Pitch",
  "Report",
  "Internal",
] as const;

export type CompanyTemplateGalleryProps = {
  companies: CompanyTemplate[];
  filtered: CompanyTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterIndustry: (typeof COMPANY_INDUSTRY_FILTERS)[number];
  onFilterIndustry: (v: (typeof COMPANY_INDUSTRY_FILTERS)[number]) => void;
  filterStyle: (typeof COMPANY_STYLE_FILTERS)[number];
  onFilterStyle: (v: (typeof COMPANY_STYLE_FILTERS)[number]) => void;
  filterUseCase: (typeof COMPANY_USE_CASE_FILTERS)[number];
  onFilterUseCase: (v: (typeof COMPANY_USE_CASE_FILTERS)[number]) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onUseTemplate: (company: CompanyTemplate) => void;
  onCustomize: (company: CompanyTemplate) => void;
  onAddTemplate?: (source: AddTemplateSource) => void;
  /** Browse vs creation flow card interactions. */
  interactionMode?: "flow" | "library";
  onDuplicate?: (company: CompanyTemplate) => void;
  onManage?: (company: CompanyTemplate) => void;
  sortControl?: ReactNode;
  /** Override hero copy (e.g. creation setup vs template library). */
  pageTitle?: string;
  pageSubtitle?: string;
};

function AddTemplateMenu({ onPick }: { onPick: (s: AddTemplateSource) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        <Plus className="size-4 shrink-0" strokeWidth={2} />
        New template
        <ChevronDown
          className={cn(
            "size-4 shrink-0 opacity-90 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-18px,380px)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 shadow-xl"
          role="menu"
          aria-label="New template options"
        >
          <p className="border-b border-[var(--border-subtle)] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Import or create
          </p>
          <ul className="max-h-[min(70vh,420px)] overflow-y-auto py-1">
            {ADD_TEMPLATE_OPTIONS.map(
              ({ source, label, description, icon: Icon }) => (
                <li key={source} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onPick(source);
                    }}
                    className="flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-inset)] focus-visible:bg-[var(--surface-inset)] focus-visible:outline-none"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-inset)] text-[var(--accent)]">
                      <Icon className="size-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">
                        {description}
                      </span>
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CompanyTemplateGallery({
  companies,
  filtered,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  filterIndustry,
  onFilterIndustry,
  filterStyle,
  onFilterStyle,
  filterUseCase,
  onFilterUseCase,
  panelOpen,
  onPanelOpenChange,
  onUseTemplate,
  onCustomize,
  onAddTemplate,
  interactionMode = "flow",
  onDuplicate,
  onManage,
  sortControl,
  pageTitle = "Choose a Presentation Style",
  pageSubtitle = "Select a design system to generate your presentation. Each style includes a set of slide layouts — you can refine them later.",
}: CompanyTemplateGalleryProps) {
  const selected = useMemo(
    () => companies.find((c) => c.id === selectedId) ?? null,
    [companies, selectedId],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[var(--background)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 max-w-2xl">
                <h1 className="text-xl font-semibold tracking-tight">
                  {pageTitle}
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {pageSubtitle}
                </p>
              </div>
              {onAddTemplate ? (
                <AddTemplateMenu onPick={onAddTemplate} />
              ) : null}
            </div>
          </header>

          <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-end">
            <div className="relative min-w-[min(100%,320px)] flex-1 max-w-xl">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search styles…"
                aria-label="Search presentation styles"
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] pl-10 pr-4 text-sm text-foreground placeholder:text-[var(--muted)] transition-shadow focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {sortControl}
              <select
                value={filterIndustry}
                onChange={(e) =>
                  onFilterIndustry(
                    e.target.value as (typeof COMPANY_INDUSTRY_FILTERS)[number],
                  )
                }
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                aria-label="Filter by industry"
              >
                {COMPANY_INDUSTRY_FILTERS.map((u) => (
                  <option key={u} value={u}>
                    {u === "all" ? "All industries" : u}
                  </option>
                ))}
              </select>
              <select
                value={filterStyle}
                onChange={(e) =>
                  onFilterStyle(
                    e.target.value as (typeof COMPANY_STYLE_FILTERS)[number],
                  )
                }
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                aria-label="Filter by style"
              >
                {COMPANY_STYLE_FILTERS.map((u) => (
                  <option key={u} value={u}>
                    {u === "all" ? "All styles" : u}
                  </option>
                ))}
              </select>
              <select
                value={filterUseCase}
                onChange={(e) =>
                  onFilterUseCase(
                    e.target.value as (typeof COMPANY_USE_CASE_FILTERS)[number],
                  )
                }
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                aria-label="Filter by use case"
              >
                {COMPANY_USE_CASE_FILTERS.map((u) => (
                  <option key={u} value={u}>
                    {u === "all" ? "All use cases" : u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-12 flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-16 text-center">
              <Palette className="mb-3 size-10 text-[var(--muted)]" />
              <p className="text-lg font-semibold tracking-tight text-foreground">
                No styles match
              </p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
                Try different filters or clear search.
              </p>
            </div>
          ) : (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {filtered.map((co) => {
                const empty = co.slideTemplates.length === 0;
                const disabled = empty;
                const secondaryActionCount =
                  1 + (onDuplicate ? 1 : 0) + (onManage ? 1 : 0);
                const secondaryGridClass =
                  secondaryActionCount >= 3
                    ? "grid-cols-3"
                    : secondaryActionCount === 2
                      ? "grid-cols-2"
                      : "grid-cols-1";
                const isLibrary = interactionMode === "library";
                return (
                  <li key={co.id}>
                    <div
                      className={cn(
                        "group/card relative flex flex-col rounded-xl border bg-[var(--surface-raised)] p-3 transition-colors",
                        disabled && "opacity-50",
                        co.id === selectedId
                          ? "border-[var(--accent)] bg-[var(--accent-muted)]/25"
                          : "border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--background)]",
                      )}
                      title={
                        disabled
                          ? "This design system has no slide templates yet."
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onSelect(co.id);
                          onPanelOpenChange(true);
                        }}
                        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed"
                        aria-label={`Select ${co.name}`}
                      />
                      <div className="pointer-events-none relative z-[1] w-full">
                        <CompanySlideStrip
                          slides={co.slideTemplates}
                          variant="hero"
                        />
                      </div>
                      <div className="pointer-events-none relative z-[1] mt-3 space-y-0.5">
                        <h2 className="text-left text-[15px] font-medium leading-snug tracking-tight text-foreground">
                          {co.name}
                        </h2>
                        {isLibrary ? (
                          <p className="line-clamp-1 text-xs text-[var(--muted)]">
                            {co.slideTemplates.length} layout
                            {co.slideTemplates.length === 1 ? "" : "s"}
                            {co.presentationUseCases.length > 0
                              ? ` · ${co.presentationUseCases.join(", ")}`
                              : ""}
                          </p>
                        ) : (
                          <p className="line-clamp-2 text-xs leading-snug text-[var(--muted)]">
                            {co.shortDescription}
                          </p>
                        )}
                      </div>
                      {isLibrary && !disabled ? (
                        <>
                          <div
                            className="pointer-events-none absolute inset-0 z-[4] rounded-xl bg-[var(--background)]/0 transition-colors duration-200 group-hover/card:bg-[var(--background)]/55 dark:group-hover/card:bg-black/25"
                            aria-hidden
                          />
                          <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] p-2 opacity-0 transition-opacity duration-200 group-hover/card:pointer-events-auto group-hover/card:opacity-100"
                          >
                            <div
                              className="pointer-events-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2 shadow-sm"
                              onClick={(e) => e.stopPropagation()}
                              role="group"
                              aria-label={`Actions for ${co.name}`}
                            >
                              <div className="flex flex-col gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUseTemplate(co);
                                  }}
                                  className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
                                >
                                  Use template
                                </button>
                                <div
                                  className={cn(
                                    "grid gap-1.5",
                                    secondaryGridClass,
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCustomize(co);
                                    }}
                                    className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                  >
                                    Customize
                                  </button>
                                  {onDuplicate ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDuplicate(co);
                                      }}
                                      className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                    >
                                      Duplicate
                                    </button>
                                  ) : null}
                                  {onManage ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onManage(co);
                                      }}
                                      className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                    >
                                      Manage
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="relative z-[2] mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUseTemplate(co);
                            }}
                            className="inline-flex flex-1 items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Use this Template
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCustomize(co);
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-2"
                          >
                            <Settings2 className="size-3.5" />
                            <span className="hidden sm:inline">Customize</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
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
          panelOpen
            ? "translate-x-0"
            : "translate-x-full pointer-events-none",
        )}
        aria-hidden={!panelOpen}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight">
            Style preview
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
                <div className="p-3">
                  <CompanySlideStrip slides={selected.slideTemplates} />
                </div>
              </div>
              <p className="mt-4 text-lg font-semibold tracking-tight">
                {selected.name}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                {selected.shortDescription}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium">
                  {selected.industry}
                </span>
                <span className="rounded-md bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium">
                  {selected.style}
                </span>
                {selected.presentationUseCases.map((u) => (
                  <span
                    key={u}
                    className="rounded-md bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                  >
                    {u}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--muted)]">
                Parent design system ·{" "}
                {selected.slideTemplates.length} slide layout
                {selected.slideTemplates.length === 1 ? "" : "s"}
              </p>
              <div className="mt-6 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-5">
                <button
                  type="button"
                  disabled={selected.slideTemplates.length === 0}
                  onClick={() => onUseTemplate(selected)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Use this Template
                </button>
                <button
                  type="button"
                  disabled={selected.slideTemplates.length === 0}
                  onClick={() => onCustomize(selected)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Settings2 className="size-4" />
                  Customize slide layouts
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Select a style from the grid to see details.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
