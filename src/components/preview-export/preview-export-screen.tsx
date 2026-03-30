"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileImage,
  FileText,
  Loader2,
  Presentation,
  Share2,
  X,
} from "lucide-react";
import { useDeck } from "@/context/deck-context";
import { DeckSlideReadonlyPreview } from "@/components/deck-preview/deck-slide-readonly-preview";
import { loadTemplateLibrary } from "@/components/template-system/template-library-storage";
import { DECK_WORKFLOW } from "@/components/workflow/deck-workflow";
import { EXPORT_FIDELITY } from "@/lib/deck/helpers";
import { getExportEditorSlidesForDeck } from "@/lib/deck/export-editor-slides";
import { downloadDeckAsPptx } from "@/lib/export/build-pptx-from-deck";

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

type ExportFormat = "pptx" | "pdf" | "assets";
type ExportPhase = "idle" | "progress" | "success";

const SHARE_URL = "https://present.app/v/demo-x7k2m9";

export function PreviewExportScreen() {
  const router = useRouter();
  const { deck, preflight } = useDeck();
  const previewSlidesEditor = useMemo(() => {
    const lib = loadTemplateLibrary();
    const company =
      deck.activeCompanyTemplateId != null
        ? lib.find((c) => c.id === deck.activeCompanyTemplateId) ?? null
        : null;
    return getExportEditorSlidesForDeck(deck, company);
  }, [deck]);

  const [index, setIndex] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pptx");
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState(0);
  const [maintainAnimations, setMaintainAnimations] = useState(true);
  const [compressImages, setCompressImages] = useState(false);
  const [themeCheck, setThemeCheck] = useState(true);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = Math.max(1, previewSlidesEditor.length);
  const currentEditorSlide = previewSlidesEditor[Math.min(index, total - 1)];

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setIndex((i) =>
        previewSlidesEditor.length === 0
          ? 0
          : Math.min(i, Math.max(0, previewSlidesEditor.length - 1)),
      );
    });
    return () => cancelAnimationFrame(id);
  }, [previewSlidesEditor.length]);

  const go = useCallback((delta: number) => {
    setIndex((i) => {
      const n = i + delta;
      if (n < 0) return total - 1;
      if (n >= total) return 0;
      return n;
    });
  }, [total]);

  const resetExport = useCallback(() => {
    setPhase("idle");
    setFormat(null);
    setProgress(0);
    setExportError(null);
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  const runPptxDownload = useCallback(async () => {
    const lib = loadTemplateLibrary();
    const company =
      deck.activeCompanyTemplateId != null
        ? lib.find((c) => c.id === deck.activeCompanyTemplateId) ?? null
        : null;
    await downloadDeckAsPptx(deck, company);
  }, [deck]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inPanel = target?.closest?.("[data-export-panel]");

      if (e.key === "ArrowRight") {
        if (inPanel) return;
        e.preventDefault();
        go(1);
      } else if (e.key === " ") {
        if (
          inPanel ||
          target?.closest?.("button, input, textarea, [role='switch']")
        ) {
          return;
        }
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        if (inPanel) return;
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        if (panelOpen) {
          e.preventDefault();
          if (phase !== "progress") {
            setPanelOpen(false);
            resetExport();
          }
        } else {
          router.push("/create/editor");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, panelOpen, phase, previewSlidesEditor.length, resetExport, router]);

  const startExport = useCallback(async () => {
    const fmt = selectedFormat;
    setFormat(fmt);
    setExportError(null);
    setPhase("progress");
    setProgress(0);
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }

    if (fmt === "pptx") {
      try {
        setProgress(30);
        await runPptxDownload();
        setProgress(100);
        setPhase("success");
      } catch (err) {
        console.error(err);
        setExportError(
          err instanceof Error
            ? err.message
            : "Could not build the PowerPoint file.",
        );
        setPhase("idle");
        setProgress(0);
      }
      return;
    }

    let p = 0;
    progressTimer.current = setInterval(() => {
      p += Math.random() * 18 + 6;
      if (p >= 100) {
        p = 100;
        if (progressTimer.current) {
          clearInterval(progressTimer.current);
          progressTimer.current = null;
        }
        setProgress(100);
        setPhase("success");
      } else {
        setProgress(Math.min(100, Math.round(p)));
      }
    }, 200);
  }, [runPptxDownload, selectedFormat]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] flex-col bg-zinc-950 text-white">
      {/* Top bar */}
      <header className="absolute left-0 right-0 top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-gradient-to-b from-black/70 to-transparent px-4 py-4 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href="/create/editor"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Exit</span>
          </Link>
          <span className="hidden max-w-[200px] truncate text-sm font-medium text-zinc-200 lg:inline">
            {deck.title}
          </span>
          <span className="hidden text-sm text-zinc-500 sm:inline">·</span>
          <p className="hidden text-sm text-zinc-400 lg:block">
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px]">
              ←
            </kbd>{" "}
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px]">
              →
            </kbd>{" "}
            navigate ·{" "}
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px]">
              Esc
            </kbd>{" "}
            {panelOpen ? "close panel" : "exit preview"}
          </p>
        </div>
        <nav
          className="hidden w-full max-w-min flex-none font-mono text-[10px] uppercase tracking-wider text-zinc-500 md:flex md:w-auto md:max-w-none md:justify-center"
          aria-label="Deck workflow"
        >
          <span className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
            {DECK_WORKFLOW.map((s, i) => (
              <span key={s.path} className="inline-flex items-center">
                {i > 0 && (
                  <span className="mx-1.5 text-zinc-700" aria-hidden>
                    /
                  </span>
                )}
                <span
                  className={cn(
                    "whitespace-nowrap tabular-nums",
                    s.path === "/preview" ? "font-medium text-white" : "",
                  )}
                >
                  {String(s.index).padStart(2, "0")} {s.label}
                </span>
              </span>
            ))}
          </span>
        </nav>
        <div className="flex flex-1 items-center justify-end gap-3">
          <span className="text-sm tabular-nums text-zinc-400">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => {
              resetExport();
              setPanelOpen(true);
            }}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
          >
            Export
          </button>
        </div>
      </header>

      {/* Slideshow */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-20">
        {previewSlidesEditor.length === 0 ? (
          <div className="flex aspect-video w-full max-w-3xl items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/80 px-8 text-center text-sm text-zinc-400">
            No slides in this deck. Add content in the Content step first.
          </div>
        ) : currentEditorSlide ? (
          <div className="slideshow-slide-enter rounded-2xl border border-white/10 bg-zinc-900/50 p-2 shadow-2xl shadow-black/50">
            <DeckSlideReadonlyPreview
              slide={currentEditorSlide}
              transitionKey={index}
              className="max-w-none border-0 shadow-none"
            />
          </div>
        ) : null}
        <div className="mt-10 flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex gap-1.5">
            {previewSlidesEditor.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-8 bg-white" : "w-1.5 bg-white/25 hover:bg-white/40",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10"
          >
            <ArrowRight className="size-5" />
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {panelOpen && (
        <button
          type="button"
          aria-label="Close export panel"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => phase !== "progress" && setPanelOpen(false)}
        />
      )}

      {/* Export panel */}
      <aside
        data-export-panel
        className={cn(
          "export-panel-enter fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--foreground)] shadow-2xl transition-transform duration-300 ease-out",
          panelOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
        aria-hidden={!panelOpen}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Export</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Final outputs & options
            </p>
          </div>
          <button
            type="button"
            disabled={phase === "progress"}
            onClick={() => {
              setPanelOpen(false);
              resetExport();
            }}
            className="flex size-10 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
          <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Pre-flight
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
              {EXPORT_FIDELITY.summary}
            </p>
            {preflight.length === 0 ? (
              <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                No structured-field issues flagged for this outline.
              </p>
            ) : (
              <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto text-xs">
                {preflight.map((issue) => (
                  <li
                    key={`${issue.code}-${issue.slideIndex}-${issue.slideId}`}
                    className={cn(
                      "rounded-lg border px-2 py-1.5",
                      issue.severity === "block"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200"
                        : "border-[var(--border-subtle)] text-[var(--muted)]",
                    )}
                  >
                    <span className="font-medium text-foreground">
                      {issue.slideIndex >= 0
                        ? `Slide ${issue.slideIndex + 1}`
                        : "Deck"}
                    </span>
                    : {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {phase === "idle" && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Format
              </p>
              <div className="mt-3 space-y-2">
                <ExportRow
                  icon={Presentation}
                  title="PowerPoint"
                  subtitle="Editable .pptx"
                  selected={selectedFormat === "pptx"}
                  onClick={() => setSelectedFormat("pptx")}
                />
                <ExportRow
                  icon={FileText}
                  title="PDF"
                  subtitle="Print & share"
                  selected={selectedFormat === "pdf"}
                  onClick={() => setSelectedFormat("pdf")}
                />
                <ExportRow
                  icon={FileImage}
                  title="Download assets"
                  subtitle="Images & media used in deck"
                  selected={selectedFormat === "assets"}
                  onClick={() => setSelectedFormat("assets")}
                />
              </div>

              <p className="mt-8 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Options
              </p>
              <ul className="mt-3 space-y-3">
                <ToggleRow
                  checked={maintainAnimations}
                  onChange={setMaintainAnimations}
                  label="Maintain animations"
                  hint="When the format supports it"
                />
                <ToggleRow
                  checked={compressImages}
                  onChange={setCompressImages}
                  label="Compress images"
                  hint="Smaller file size"
                />
                <ToggleRow
                  checked={themeCheck}
                  onChange={setThemeCheck}
                  label="Theme consistency check"
                  hint="Flag off-template colors before export"
                />
              </ul>

              {exportError ? (
                <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                  {exportError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void startExport()}
                className="mt-8 w-full rounded-full bg-[var(--accent)] py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Export{" "}
                {selectedFormat === "pptx"
                  ? "PowerPoint"
                  : selectedFormat === "pdf"
                    ? "PDF"
                    : "assets"}
              </button>

              <div className="mt-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Share2 className="size-4 text-[var(--accent)]" />
                  Share link
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  View-only. Anyone with the link can present.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    readOnly
                    value={SHARE_URL}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-xs text-[var(--muted)]"
                  />
                  <button
                    type="button"
                    onClick={copyShare}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    <Copy className="size-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </>
          )}

          {phase === "progress" && (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
              <p className="mt-6 text-base font-medium">
                Exporting{" "}
                {format === "pptx"
                  ? "PowerPoint"
                  : format === "pdf"
                    ? "PDF"
                    : "assets"}
                …
              </p>
              <div className="mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--surface-inset)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-sm tabular-nums text-[var(--muted)]">
                {progress}%
              </p>
              {themeCheck && (
                <p className="mt-6 text-xs text-[var(--muted)]">
                  Running theme consistency check…
                </p>
              )}
            </div>
          )}

          {phase === "success" && (
            <div className="flex flex-1 flex-col items-center py-10 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Check className="size-8 stroke-[2.5]" />
              </div>
              <h3 className="mt-6 text-lg font-semibold">Ready</h3>
              <p className="mt-2 max-w-xs text-sm text-[var(--muted)]">
                {format === "pptx"
                  ? "Your .pptx file was saved using the browser download. Use Download again if the dialog was dismissed."
                  : format === "pdf"
                    ? "PDF export is not generated in the browser yet — choose PowerPoint and print to PDF, or use your OS print dialog."
                    : "Asset bundle packaging is not wired in this build yet."}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (format === "pptx") void runPptxDownload();
                }}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                disabled={format !== "pptx"}
              >
                <Download className="size-4" />
                Download again
              </button>
              <button
                type="button"
                onClick={() => {
                  resetExport();
                  setPanelOpen(false);
                }}
                className="mt-4 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ExportRow({
  icon: Icon,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: typeof Presentation;
  title: string;
  subtitle: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-colors",
        selected
          ? "border-[var(--accent)]/50 bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20"
          : "border-[var(--border-subtle)] bg-[var(--background)] hover:border-[var(--accent)]/25 hover:bg-[var(--surface-inset)]/40",
      )}
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-inset)]">
        <Icon className="size-5 text-[var(--foreground)]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-[var(--muted)]" />
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--accent)]" : "bg-[var(--surface-inset)]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "left-6" : "left-1",
          )}
        />
      </button>
    </li>
  );
}
