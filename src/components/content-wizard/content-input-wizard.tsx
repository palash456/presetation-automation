"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { useDeck } from "@/context/deck-context";
import { deckSlidePatchForSlideType } from "@/lib/deck/helpers";
import type { DeckSlide } from "@/lib/deck/types";
import { structuredContentFromUploadPlaceholder } from "@/core/parser/upload-placeholder";
import { slideContentRowsFromStructured } from "@/core/parser/structured-to-slide-rows";
import { slidesFromPlainText } from "./initial-slides";
import type { SlideContent, SlideType } from "./types";
import { countBulletsChars, slideHasOverflow } from "./types";

const SLIDE_TYPES: { value: SlideType; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "content", label: "Content" },
  { value: "comparison", label: "Comparison" },
  { value: "data", label: "Data" },
  { value: "section", label: "Section" },
  { value: "closing", label: "Closing" },
];

const TONES = [
  "Professional",
  "Persuasive",
  "Friendly",
  "Technical",
  "Concise",
] as const;

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

function ActiveStyleBanner({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <div
      className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--accent-muted)]/50 px-4 py-2 text-center text-xs leading-relaxed text-foreground/90"
      role="status"
    >
      Using <span className="font-semibold">{name}</span> for this presentation
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 font-medium",
          step === 1
            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
            : "bg-[var(--surface-inset)]",
        )}
      >
        1 · Source
      </span>
      <span className="text-[var(--border-subtle)]">→</span>
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 font-medium",
          step === 2
            ? "bg-[var(--accent-muted)] text-[var(--accent)]"
            : "bg-[var(--surface-inset)]",
        )}
      >
        2 · Structure
      </span>
    </div>
  );
}

export function ContentInputWizard() {
  const {
    deck,
    setWizardMeta,
    replaceSlidesFromPlainContent,
    updateDeckSlide,
  } = useDeck();
  const mappingPool = deck.allowedMappingPresetIds;
  const step = deck.wizardStep;
  const entryMethod = deck.entryMethod;
  const pasteText = deck.pasteText;
  const aiPrompt = deck.aiPrompt;
  const uploadLabel = deck.uploadLabel;
  const slides = deck.slides;
  const [activeId, setActiveId] = useState<string | null>(null);

  const resolvedSlideId = useMemo(() => {
    if (slides.length === 0) return null;
    if (activeId && slides.some((s) => s.id === activeId)) return activeId;
    return slides[0]!.id;
  }, [slides, activeId]);

  const active = useMemo(
    () =>
      resolvedSlideId
        ? slides.find((s) => s.id === resolvedSlideId) ?? null
        : null,
    [slides, resolvedSlideId],
  );

  const updateSlide = useCallback(
    (id: string, patch: Partial<SlideContent>) => {
      updateDeckSlide(id, patch as Partial<DeckSlide>);
    },
    [updateDeckSlide],
  );

  const finishStep1 = () => {
    if (entryMethod === "paste") {
      const t = pasteText.trim();
      if (!t) return;
      const built = slidesFromPlainText(t);
      replaceSlidesFromPlainContent(built);
      setActiveId(built[0]?.id ?? null);
    } else if (entryMethod === "ai") {
      const p = aiPrompt.trim();
      if (!p) return;
      const synthetic = slidesFromPlainText(
        `${p}\n\nSummary slide\nKey takeaway one\nKey takeaway two\nKey takeaway three\n\nNext steps\nWe align owners\nWe ship in two sprints\nWe review metrics weekly`,
      );
      replaceSlidesFromPlainContent(synthetic);
      setActiveId(synthetic[0]?.id ?? null);
    } else {
      const label = uploadLabel ?? "uploaded-deck.pptx";
      setWizardMeta({
        uploadLabel: label,
      });
      const rows = slideContentRowsFromStructured(
        structuredContentFromUploadPlaceholder(label),
      );
      replaceSlidesFromPlainContent(rows);
      setActiveId(rows[0]?.id ?? null);
    }
  };

  const canContinueStep1 =
    entryMethod === "paste"
      ? pasteText.trim().length > 0
      : entryMethod === "ai"
        ? aiPrompt.trim().length > 0
        : Boolean(uploadLabel);

  const bulletsText = active
    ? active.bullets.join("\n")
    : "";

  const setBulletsFromText = (text: string) => {
    if (!active) return;
    const bullets = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    updateSlide(active.id, { bullets });
  };

  const applyAiImprove = () => {
    if (!active) return;
    const t = active.title.trim();
    const sub = active.subtitle.trim();
    updateSlide(active.id, {
      title: t ? t[0]!.toUpperCase() + t.slice(1) : t,
      subtitle: sub
        ? sub.replace(/\s+/g, " ").replace(/\.$/, "") + "."
        : active.subtitle || "Supporting context refined for clarity.",
    });
  };

  const applyAiExpand = () => {
    if (!active) return;
    updateSlide(active.id, {
      bullets: active.bullets.map((b) =>
        b.length < 40 ? `${b} (Additional context for stakeholders.)` : b,
      ),
    });
  };

  const applyAiShorten = () => {
    if (!active) return;
    updateSlide(active.id, {
      bullets: active.bullets.map((b) =>
        b.length > 50 ? b.slice(0, 47).trimEnd() + "…" : b,
      ),
      notes:
        active.notes.length > 80
          ? active.notes.slice(0, 77).trimEnd() + "…"
          : active.notes,
    });
  };

  const applyTone = (tone: string) => {
    if (!active) return;
    updateSlide(active.id, {
      notes: `[${tone} tone}] ${active.notes || "Speaker notes aligned to " + tone.toLowerCase() + " delivery."}`,
    });
  };

  if (step === 1) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
        <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Add your content
              </h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Choose how content enters — you&apos;ll structure it next.
              </p>
            </div>
            <StepIndicator step={1} />
          </div>
        </header>
        <ActiveStyleBanner name={deck.activeCompanyTemplateName} />

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto px-6 py-8">
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                {
                  id: "upload" as const,
                  icon: Upload,
                  title: "Upload file",
                  desc: "PPT, DOCX, or TXT — we extract outline and text.",
                },
                {
                  id: "paste" as const,
                  icon: FileText,
                  title: "Paste text",
                  desc: "Plain text or outline — paragraphs become slides.",
                },
                {
                  id: "ai" as const,
                  icon: Wand2,
                  title: "Generate with AI",
                  desc: "Describe the deck — we draft a first structure.",
                },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const on = entryMethod === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setWizardMeta({ entryMethod: opt.id })}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-4 text-left transition-colors",
                    on
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/25"
                      : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--muted)]/40",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-8",
                      on ? "text-[var(--accent)]" : "text-[var(--muted)]",
                    )}
                    strokeWidth={1.75}
                  />
                  <div>
                    <p className="font-semibold">{opt.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
            {entryMethod === "upload" && (
              <div>
                <span className="text-sm font-medium">File</span>
                <label className="mt-2 flex w-full cursor-pointer flex-col">
                  <input
                    type="file"
                    accept=".ppt,.pptx,.doc,.docx,.txt"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setWizardMeta({ uploadLabel: f?.name ?? null });
                    }}
                  />
                  <span className="flex min-h-[min(240px,40vh)] w-full items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--background)] px-4 py-10 text-center text-sm leading-relaxed text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50">
                    {uploadLabel
                      ? uploadLabel
                      : "Drop a file here or click to browse"}
                  </span>
                </label>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  PPT · DOCX · TXT · Max size per your workspace policy
                </p>
              </div>
            )}

            {entryMethod === "paste" && (
              <div>
                <label className="text-sm font-medium">Plain text</label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setWizardMeta({ pasteText: e.target.value })}
                  rows={12}
                  placeholder="Paste outline or notes. Blank lines separate slides. Use lines starting with - for bullets."
                  className="mt-2 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                />
              </div>
            )}

            {entryMethod === "ai" && (
              <div>
                <label className="text-sm font-medium">Prompt</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setWizardMeta({ aiPrompt: e.target.value })}
                  rows={8}
                  placeholder="e.g. 8-slide board update: north star metric, risks, hiring, Q3 plan — formal tone."
                  className="mt-2 w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/templates"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 text-sm font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              Template setup
            </Link>
            <button
              type="button"
              disabled={!canContinueStep1}
              onClick={finishStep1}
              className="h-11 rounded-xl bg-[var(--accent)] px-6 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              Continue to structure
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Step 2 */
  if (slides.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
        <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setWizardMeta({ wizardStep: 1 })}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight">
                Structure content
              </h1>
              <p className="truncate text-xs text-[var(--muted)]">
                Add a source first — this deck has no slides yet.
              </p>
            </div>
          </div>
          <StepIndicator step={2} />
        </header>
        <ActiveStyleBanner name={deck.activeCompanyTemplateName} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="max-w-sm text-center text-sm text-[var(--muted)]">
            Load text in step 1 or use the deck bar &quot;Sample&quot; outline to
            populate slides.
          </p>
          <button
            type="button"
            onClick={() => setWizardMeta({ wizardStep: 1 })}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Go to source
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setWizardMeta({ wizardStep: 1 })}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              Structure content
            </h1>
            <p className="truncate text-xs text-[var(--muted)]">
              Notion-style fields · per-slide template fit · overflow checks
            </p>
          </div>
        </div>
        <StepIndicator step={2} />
      </header>
      <ActiveStyleBanner name={deck.activeCompanyTemplateName} />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto">
        {/* LEFT — slide list */}
        <aside className="flex w-[272px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="border-b border-[var(--border-subtle)] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Slides · {slides.length}
            </p>
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {slides.map((s, idx) => {
              const ov = slideHasOverflow(s);
              const anyOv = ov.title || ov.subtitle || ov.bullets || ov.notes;
              const snippet =
                s.subtitle ||
                s.bullets[0] ||
                s.notes.slice(0, 80) ||
                "No body yet";
              const sel = s.id === resolvedSlideId;
              return (
                <li key={s.id} className="mb-2">
                  <button
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      sel
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/25"
                        : "border-[var(--border-subtle)] bg-[var(--background)] hover:border-[var(--muted)]/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium text-[var(--muted)]">
                        {idx + 1}
                      </span>
                      {anyOv && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-400"
                          title="Over template limits"
                        >
                          <AlertTriangle className="size-3" />
                          Overflow
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
                      {s.title || "Untitled"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                      {snippet}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={s.slideType}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const v = e.target.value as SlideType;
                          updateDeckSlide(s.id, {
                            ...deckSlidePatchForSlideType(s, v, mappingPool),
                          });
                        }}
                        className="max-w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-medium focus:border-[var(--accent)] focus:outline-none"
                      >
                        {SLIDE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <span
                        className="rounded-md bg-[var(--surface-inset)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--muted)]"
                        title="Template match score"
                      >
                        Match {s.templateMatchScore}%
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-inset)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                        style={{ width: `${s.templateMatchScore}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* CENTER — structured editor */}
        <section className="min-w-0 flex-1 overflow-y-auto bg-[var(--background)]">
          {active ? (
            <div className="mx-auto max-w-2xl px-6 py-6">
              <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] pb-4">
                <span className="text-xs text-[var(--muted)]">Slide type</span>
                <select
                  value={active.slideType}
                  onChange={(e) =>
                    updateDeckSlide(active.id, {
                      ...deckSlidePatchForSlideType(
                        active,
                        e.target.value as SlideType,
                        mappingPool,
                      ),
                    })
                  }
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm font-medium focus:border-[var(--accent)] focus:outline-none"
                >
                  {SLIDE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="ml-auto text-xs tabular-nums text-[var(--muted)]">
                  Template match{" "}
                  <strong className="text-foreground">
                    {active.templateMatchScore}%
                  </strong>
                </span>
              </div>

              <div className="space-y-6">
                <FieldBlock
                  label="Title"
                  current={active.title.length}
                  limit={active.limits.title}
                  over={slideHasOverflow(active).title}
                >
                  <input
                    type="text"
                    value={active.title}
                    onChange={(e) =>
                      updateSlide(active.id, { title: e.target.value })
                    }
                    className={cn(
                      "w-full rounded-xl border bg-[var(--surface-raised)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]",
                      slideHasOverflow(active).title
                        ? "border-amber-500/80"
                        : "border-[var(--border-subtle)] focus:border-[var(--accent)]",
                    )}
                  />
                </FieldBlock>

                <FieldBlock
                  label="Subtitle"
                  current={active.subtitle.length}
                  limit={active.limits.subtitle}
                  over={slideHasOverflow(active).subtitle}
                >
                  <input
                    type="text"
                    value={active.subtitle}
                    onChange={(e) =>
                      updateSlide(active.id, { subtitle: e.target.value })
                    }
                    className={cn(
                      "w-full rounded-xl border bg-[var(--surface-raised)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]",
                      slideHasOverflow(active).subtitle
                        ? "border-amber-500/80"
                        : "border-[var(--border-subtle)] focus:border-[var(--accent)]",
                    )}
                  />
                </FieldBlock>

                <FieldBlock
                  label="Bullets"
                  hint="One bullet per line"
                  current={
                    active.bullets.length
                      ? Math.max(...active.bullets.map((b) => b.length))
                      : 0
                  }
                  limit={active.limits.bulletLine}
                  over={slideHasOverflow(active).bullets}
                  extra={`${countBulletsChars(active.bullets)} chars total · longest line vs per-line max`}
                >
                  <textarea
                    value={bulletsText}
                    onChange={(e) => setBulletsFromText(e.target.value)}
                    rows={8}
                    className={cn(
                      "w-full resize-y rounded-xl border bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]",
                      slideHasOverflow(active).bullets
                        ? "border-amber-500/80"
                        : "border-[var(--border-subtle)] focus:border-[var(--accent)]",
                    )}
                  />
                </FieldBlock>

                <FieldBlock
                  label="Notes"
                  current={active.notes.length}
                  limit={active.limits.notes}
                  over={slideHasOverflow(active).notes}
                >
                  <textarea
                    value={active.notes}
                    onChange={(e) =>
                      updateSlide(active.id, { notes: e.target.value })
                    }
                    rows={4}
                    placeholder="Speaker notes — not on slide"
                    className={cn(
                      "w-full resize-y rounded-xl border bg-[var(--surface-raised)] px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]",
                      slideHasOverflow(active).notes
                        ? "border-amber-500/80"
                        : "border-[var(--border-subtle)] focus:border-[var(--accent)]",
                    )}
                  />
                </FieldBlock>

                <div>
                  <label className="text-sm font-medium text-[var(--muted)]">
                    Media placeholders
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {active.mediaPlaceholders.length === 0 ? (
                      <span className="text-sm text-[var(--muted)]">
                        None for this layout
                      </span>
                    ) : (
                      active.mediaPlaceholders.map((m) => (
                        <span
                          key={m}
                          className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)]"
                        >
                          {m}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* RIGHT — AI co-pilot */}
        <aside className="flex w-[min(320px,30vw)] min-w-[260px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="flex h-11 items-center gap-2 border-b border-[var(--border-subtle)] px-4">
            <Sparkles className="size-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold tracking-tight">
              AI suggestions
            </h2>
          </div>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Applies to the selected slide. Edits are local until you save the
              deck.
            </p>
            <div className="flex flex-col gap-2">
              <AiActionButton
                label="Improve wording"
                onClick={applyAiImprove}
                disabled={!active}
              />
              <AiActionButton
                label="Expand bullets"
                onClick={applyAiExpand}
                disabled={!active}
              />
              <AiActionButton
                label="Shorten content"
                onClick={applyAiShorten}
                disabled={!active}
              />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Change tone
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    disabled={!active}
                    onClick={() => applyTone(tone)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex shrink-0 flex-col gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs leading-relaxed text-[var(--muted)]">
          When fields look right, map slides to template presets — then refine
          in the editor.
        </p>
        <Link
          href="/create/mapping"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
        >
          Continue to map
        </Link>
      </footer>
    </div>
  );
}

function FieldBlock({
  label,
  hint,
  current,
  limit,
  over,
  extra,
  children,
}: {
  label: string;
  hint?: string;
  current: number;
  limit: number;
  over: boolean;
  extra?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label className="text-sm font-medium">{label}</label>
        <span
          className={cn(
            "text-xs tabular-nums",
            over ? "font-medium text-amber-700 dark:text-amber-400" : "text-[var(--muted)]",
          )}
        >
          {current}/{limit}
          {over && " · over limit"}
        </span>
      </div>
      {hint && (
        <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
      )}
      {extra && (
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">{extra}</p>
      )}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function AiActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-inset)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {label}
    </button>
  );
}
