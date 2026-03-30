"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Lock,
  RefreshCw,
  Sparkles,
  Unlock,
} from "lucide-react";
import { useDeck } from "@/context/deck-context";
import { ALL_TEMPLATE_IDS, TEMPLATE_CATALOG } from "./template-catalog";
import {
  jitterScore,
  randomReasoning,
  remapAlternatives,
} from "./mock-slides";
import { SlideTemplatePreview } from "./slide-template-preview";
import type { TemplateAlternative, TemplatePresetId } from "./types";

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

function MatchScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const deg = (pct / 100) * 360;
  return (
    <div className="relative mx-auto size-28">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--accent) ${deg}deg, var(--surface-inset) ${deg}deg)`,
        }}
      />
      <div className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full bg-[var(--surface-raised)]">
        <span className="text-2xl font-bold tabular-nums tracking-tight">
          {pct}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Match
        </span>
      </div>
    </div>
  );
}

export function TemplateMappingScreen() {
  const { deck, updateDeckSlide } = useDeck();
  const slides = deck.slides;
  const mappingPool = deck.allowedMappingPresetIds;
  const templateChoices = useMemo(() => {
    if (mappingPool && mappingPool.length > 0) return mappingPool;
    return ALL_TEMPLATE_IDS;
  }, [mappingPool]);

  const outsideActivePool = useMemo(() => {
    if (!mappingPool || mappingPool.length === 0) return false;
    return slides.some((s) => !mappingPool.includes(s.assignedTemplateId));
  }, [slides, mappingPool]);

  const anyClosestFallback = useMemo(
    () =>
      slides.some((s) =>
        s.reasoning.includes("closest alternative"),
      ),
    [slides],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [previewTick, setPreviewTick] = useState(0);

  const resolvedSlideId = useMemo(() => {
    if (slides.length === 0) return null;
    if (activeId && slides.some((s) => s.id === activeId)) return activeId;
    return slides[0]!.id;
  }, [slides, activeId]);

  const active = useMemo(() => {
    if (slides.length === 0 || !resolvedSlideId) return null;
    return slides.find((s) => s.id === resolvedSlideId) ?? slides[0]!;
  }, [slides, resolvedSlideId]);

  const bumpPreview = useCallback(() => {
    setPreviewTick((t) => t + 1);
  }, []);

  const applyTemplate = useCallback(
    (templateId: TemplatePresetId, alt?: TemplateAlternative) => {
      const cur = resolvedSlideId
        ? slides.find((s) => s.id === resolvedSlideId)
        : undefined;
      if (!cur || cur.locked) return;
      const score = alt?.matchScore ?? jitterScore(cur.matchScore);
      const reasoning = alt?.reasoning ?? randomReasoning();
      updateDeckSlide(cur.id, {
        assignedTemplateId: templateId,
        matchScore: score,
        reasoning,
        alternatives: remapAlternatives(templateId, deck.allowedMappingPresetIds),
      });
      setCarouselIndex(0);
      bumpPreview();
    },
    [deck.allowedMappingPresetIds, resolvedSlideId, bumpPreview, slides, updateDeckSlide],
  );

  const setLocked = useCallback(
    (locked: boolean) => {
      const cur = resolvedSlideId
        ? slides.find((s) => s.id === resolvedSlideId)
        : undefined;
      if (!cur) return;
      updateDeckSlide(cur.id, { locked });
    },
    [resolvedSlideId, slides, updateDeckSlide],
  );

  const rerunAi = useCallback(() => {
    const cur = resolvedSlideId
      ? slides.find((s) => s.id === resolvedSlideId)
      : undefined;
    if (!cur || cur.locked) return;
    updateDeckSlide(cur.id, {
      matchScore: jitterScore(cur.matchScore),
      reasoning: randomReasoning(),
      alternatives: remapAlternatives(
        cur.assignedTemplateId,
        deck.allowedMappingPresetIds,
      ),
    });
    setCarouselIndex(0);
    bumpPreview();
  }, [deck.allowedMappingPresetIds, resolvedSlideId, bumpPreview, slides, updateDeckSlide]);

  const alts = active?.alternatives ?? [];
  const safeCarousel = alts.length ? carouselIndex % alts.length : 0;
  const carouselAlt = alts[safeCarousel];

  if (slides.length === 0 || !active) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
        <header className="flex h-12 shrink-0 items-center justify-end border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4">
          <Link
            href="/create/content"
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <ChevronLeft className="size-3.5" />
            Content
          </Link>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
          <p className="max-w-sm text-center text-sm text-[var(--muted)]">
            This deck has no slides yet. Structure an outline in content input,
            or add a starter outline from the deck bar when the outline is empty.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
      <header className="flex min-h-12 shrink-0 flex-col gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutGrid className="size-4 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              Mapping
            </h1>
            <p className="truncate text-xs text-[var(--muted)]">
              Assign each slide to a template; preview updates as you change
              assignments.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full bg-[var(--accent-muted)] px-3 py-1 text-[11px] font-medium text-[var(--accent)] sm:inline-flex">
            <Sparkles className="size-3" />
            AI-assisted
          </span>
          <Link
            href="/create/editor"
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-[var(--accent)] px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
          >
            Open editor
            <ChevronRight className="size-3.5" strokeWidth={2} />
          </Link>
        </div>
      </header>

      {(mappingPool &&
        mappingPool.length > 0 &&
        deck.activeCompanyTemplateName) ||
      outsideActivePool ||
      anyClosestFallback ? (
        <div
          className="shrink-0 space-y-1 border-b border-[var(--border-subtle)] bg-[var(--accent-muted)]/35 px-4 py-2 text-xs leading-relaxed text-foreground/90"
          role="status"
        >
          {mappingPool &&
            mappingPool.length > 0 &&
            deck.activeCompanyTemplateName && (
              <p>
                <span className="font-medium text-foreground">
                  Active design system:
                </span>{" "}
                {deck.activeCompanyTemplateName}. Mapping choices are limited to
                templates in this style.
              </p>
            )}
          {anyClosestFallback && (
            <p className="flex items-start gap-2 text-amber-950/90 dark:text-amber-100/95">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                No matching template found for some slides — using the closest
                alternative. Check reasoning per slide.
              </span>
            </p>
          )}
          {outsideActivePool && (
            <p className="flex items-start gap-2 text-amber-950/90 dark:text-amber-100/95">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Some slides still reference a template outside this style — pick
                an option from the list or switch style in Template setup.
              </span>
            </p>
          )}
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto">
        {/* LEFT */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="border-b border-[var(--border-subtle)] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Slides
            </p>
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {slides.map((s, idx) => {
              const sel = s.id === resolvedSlideId;
              const warn =
                s.overflowRisk ||
                s.layoutBreakRisk ||
                (mappingPool &&
                  mappingPool.length > 0 &&
                  !mappingPool.includes(s.assignedTemplateId));
              return (
                <li key={s.id} className="mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(s.id);
                      setCarouselIndex(0);
                      bumpPreview();
                    }}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-all duration-200",
                      sel
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/30"
                        : "border-[var(--border-subtle)] bg-[var(--background)] hover:border-[var(--muted)]/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--muted)]">
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        {s.locked && (
                          <Lock
                            className="size-3.5 text-[var(--muted)]"
                            aria-label="Locked"
                          />
                        )}
                        {warn && (
                          <AlertTriangle
                            className="size-3.5 text-amber-600 dark:text-amber-400"
                            aria-label="Warnings"
                          />
                        )}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
                      {s.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
                      {TEMPLATE_CATALOG[s.assignedTemplateId].shortLabel} ·{" "}
                      {s.matchScore}%
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* CENTER */}
        <section className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-[var(--surface-inset)]/35 p-6">
          <p className="mb-4 text-center text-xs text-[var(--muted)]">
            Applied template updates in real time
          </p>
          <div className="mapping-preview-shell w-full max-w-4xl transition-[filter,opacity] duration-300 ease-out">
            <SlideTemplatePreview
              templateId={active.assignedTemplateId}
              slide={{
                title: active.title,
                subtitle: active.subtitle,
                bullets: active.bullets,
              }}
              transitionKey={previewTick}
            />
          </div>
        </section>

        {/* RIGHT */}
        <aside className="flex w-[min(380px,34vw)] min-w-[300px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="flex h-11 items-center border-b border-[var(--border-subtle)] px-4">
            <h2 className="text-sm font-semibold tracking-tight">
              Mapping
            </h2>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="border-b border-[var(--border-subtle)] p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Selected template
              </p>
              <p className="mt-1 text-lg font-semibold leading-tight">
                {TEMPLATE_CATALOG[active.assignedTemplateId].name}
              </p>
              <div className="mt-4">
                <MatchScoreRing score={active.matchScore} />
              </div>
            </div>

            <div className="border-b border-[var(--border-subtle)] p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Reasoning
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                {active.reasoning}
              </p>
              <label className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Your note
              </label>
              <textarea
                value={active.reasoningNote ?? ""}
                onChange={(e) =>
                  updateDeckSlide(active.id, { reasoningNote: e.target.value })
                }
                rows={3}
                placeholder="Decision notes, caveats, stakeholder context…"
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
              />
            </div>

            <div className="border-b border-[var(--border-subtle)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Alternatives
                </p>
                <span className="text-[10px] text-[var(--muted)]">
                  {alts.length ? `${safeCarousel + 1} / ${alts.length}` : "—"}
                </span>
              </div>
              {carouselAlt && (
                <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] p-3 transition-all duration-300 ease-out">
                  <p className="font-medium leading-tight">{carouselAlt.name}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    Match {carouselAlt.matchScore}%
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                    {carouselAlt.reasoning}
                  </p>
                  <button
                    type="button"
                    disabled={active.locked}
                    onClick={() => applyTemplate(carouselAlt.id, carouselAlt)}
                    className="mt-3 w-full rounded-lg bg-[var(--accent)] py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Use this template
                  </button>
                </div>
              )}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Previous alternative"
                  disabled={alts.length < 2}
                  onClick={() =>
                    setCarouselIndex((i) => (i - 1 + alts.length) % alts.length)
                  }
                  className="flex size-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] transition-colors hover:bg-[var(--surface-inset)] disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex gap-1">
                  {alts.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to alternative ${i + 1}`}
                      onClick={() => setCarouselIndex(i)}
                      className={cn(
                        "size-2 rounded-full transition-colors",
                        i === safeCarousel
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--border-subtle)] hover:bg-[var(--muted)]",
                      )}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Next alternative"
                  disabled={alts.length < 2}
                  onClick={() =>
                    setCarouselIndex((i) => (i + 1) % alts.length)
                  }
                  className="flex size-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] transition-colors hover:bg-[var(--surface-inset)] disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Change template
                </label>
                <select
                  value={active.assignedTemplateId}
                  disabled={active.locked}
                  onChange={(e) =>
                    applyTemplate(e.target.value as TemplatePresetId)
                  }
                  className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {templateChoices.map((id) => (
                    <option key={id} value={id}>
                      {TEMPLATE_CATALOG[id].name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLocked(!active.locked)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors min-w-[120px]",
                    active.locked
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                      : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                  )}
                >
                  {active.locked ? (
                    <>
                      <Lock className="size-3.5" />
                      Locked
                    </>
                  ) : (
                    <>
                      <Unlock className="size-3.5" />
                      Lock template
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={active.locked}
                  onClick={rerunAi}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] disabled:cursor-not-allowed disabled:opacity-40 min-w-[120px]"
                >
                  <RefreshCw className="size-3.5" />
                  Re-run AI
                </button>
              </div>
            </div>

            {(active.overflowRisk || active.layoutBreakRisk) && (
              <div className="mt-auto border-t border-[var(--border-subtle)] bg-amber-500/5 p-4 dark:bg-amber-500/10">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="size-4 shrink-0" />
                  Warnings
                </p>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90">
                  {active.overflowRisk && (
                    <li>
                      <strong>Overflow risk:</strong> Text may exceed template
                      character rails — trim bullets or pick a denser layout.
                    </li>
                  )}
                  {active.layoutBreakRisk && (
                    <li>
                      <strong>Layout break risk:</strong> Content shape
                      doesn&apos;t match split columns; consider classic or data
                      templates.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
