"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeck } from "@/context/deck-context";
import { loadTemplateLibrary } from "@/components/template-system/template-library-storage";
import { buildEditorSlidesFromDeck } from "@/lib/deck/helpers";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BarChart3,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Grid3x3,
  ImageIcon,
  Minus,
  Plus,
  Redo2,
  Shapes,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { SlideCanvas } from "./slide-canvas";
import type {
  EditorElement,
  EditorSlide,
  EditorTextElement,
  PlaceholderKind,
  TextAlign,
} from "./types";

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const FONT_OPTIONS = [
  { value: "var(--font-geist-sans), system-ui, sans-serif", label: "Geist Sans" },
  { value: "Georgia, serif", label: "Serif" },
  { value: "ui-monospace, monospace", label: "Mono" },
];

export function EditorScreen() {
  const { deck, pushEditorSlides } = useDeck();
  const [slides, setSlides] = useState<EditorSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [zoom, setZoom] = useState(1);
  const [gridVisible, setGridVisible] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [past, setPast] = useState<EditorSlide[][]>([]);
  const [future, setFuture] = useState<EditorSlide[][]>([]);
  const [dragSlideId, setDragSlideId] = useState<string | null>(null);

  const deckSlideSig = useMemo(
    () => deck.slides.map((s) => s.id).join("|"),
    [deck.slides],
  );

  const mappingSig = useMemo(
    () => deck.slides.map((s) => `${s.id}:${s.assignedTemplateId}`).join("|"),
    [deck.slides],
  );

  const prevMappingSig = useRef<string | undefined>(undefined);
  const prevCompanyId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (deck.slides.length === 0) {
        setSlides([]);
        return;
      }
      const lib = loadTemplateLibrary();
      const company =
        lib.find((c) => c.id === deck.activeCompanyTemplateId) ?? null;

      const mappingChanged =
        prevMappingSig.current !== undefined &&
        prevMappingSig.current !== mappingSig;
      prevMappingSig.current = mappingSig;

      const companyChanged =
        prevCompanyId.current !== undefined &&
        prevCompanyId.current !== (deck.activeCompanyTemplateId ?? null);
      prevCompanyId.current = deck.activeCompanyTemplateId ?? null;

      const lenOk =
        deck.editorSlides && deck.editorSlides.length === deck.slides.length;

      const shouldRebuild =
        !lenOk || mappingChanged || companyChanged;

      const initial = shouldRebuild
        ? buildEditorSlidesFromDeck(deck.slides, company)
        : deepClone(deck.editorSlides!);

      setActiveIndex((i) => Math.min(i, Math.max(0, initial.length - 1)));
      setSlides(initial);
      setPast([]);
      setFuture([]);
      setSelectedElementId(null);

      if (shouldRebuild) {
        pushEditorSlides(initial);
      }
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid deck.editorSlides in deps (feedback loop)
  }, [
    deckSlideSig,
    deck.layoutGeneration,
    mappingSig,
    deck.activeCompanyTemplateId,
    pushEditorSlides,
  ]);

  const slidesRef = useRef(slides);
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  const activeSlide = slides[activeIndex] ?? slides[0];

  const selectedEl = useMemo(
    () =>
      activeSlide?.elements.find((e) => e.id === selectedElementId) ?? null,
    [activeSlide, selectedElementId],
  );

  const selectedText =
    selectedEl?.type === "text" ? selectedEl : null;

  const commit = useCallback(
    (next: EditorSlide[]) => {
      setPast((p) => [...p, deepClone(slidesRef.current)].slice(-40));
      setFuture([]);
      setSlides(next);
      pushEditorSlides(next);
    },
    [pushEditorSlides],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1]!;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [deepClone(slidesRef.current), ...f]);
    setSlides(prev);
    pushEditorSlides(prev);
    setSelectedElementId(null);
  }, [past, pushEditorSlides]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const n = future[0]!;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, deepClone(slidesRef.current)]);
    setSlides(n);
    pushEditorSlides(n);
    setSelectedElementId(null);
  }, [future, pushEditorSlides]);

  const updateSlide = useCallback(
    (patch: Partial<EditorSlide>) => {
      const next = slides.map((s, i) =>
        i === activeIndex ? { ...s, ...patch } : s,
      );
      commit(next);
    },
    [slides, activeIndex, commit],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<EditorTextElement>) => {
      const next = slides.map((s, i) => {
        if (i !== activeIndex) return s;
        return {
          ...s,
          elements: s.elements.map((el) =>
            el.id === id && el.type === "text"
              ? { ...el, ...patch }
              : el,
          ),
        };
      });
      commit(next);
    },
    [slides, activeIndex, commit],
  );

  const updateTextContent = useCallback(
    (id: string, content: string) => {
      updateElement(id, { content });
    },
    [updateElement],
  );

  const duplicateSlide = useCallback(() => {
    if (!activeSlide) return;
    const copy = deepClone(activeSlide);
    copy.id = newId("slide");
    copy.elements = copy.elements.map((e) => ({
      ...e,
      id: newId("el"),
    }));
    const next = [
      ...slides.slice(0, activeIndex + 1),
      copy,
      ...slides.slice(activeIndex + 1),
    ];
    commit(next);
    setActiveIndex(activeIndex + 1);
    setSelectedElementId(null);
  }, [slides, activeIndex, activeSlide, commit]);

  const deleteSlide = useCallback(() => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== activeIndex);
    commit(next);
    setActiveIndex(Math.min(activeIndex, next.length - 1));
    setSelectedElementId(null);
  }, [slides, activeIndex, commit]);

  const addPlaceholder = useCallback(
    (kind: PlaceholderKind, label: string) => {
      const el: EditorElement = {
        type: "placeholder",
        id: newId("ph"),
        role: label,
        placeholderKind: kind,
        label,
        x: 12,
        y: 60,
        w: 28,
        h: 28,
        locked: false,
      };
      const next = slides.map((s, i) =>
        i === activeIndex ? { ...s, elements: [...s.elements, el] } : s,
      );
      commit(next);
      setSelectedElementId(el.id);
    },
    [slides, activeIndex, commit],
  );

  const exportDeck = useCallback(() => {
    const json = JSON.stringify(slides, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deck.editor.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [slides]);

  const onThumbDragStart = (id: string) => setDragSlideId(id);
  const onThumbDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onThumbDrop = (targetIndex: number) => {
    if (!dragSlideId) return;
    const from = slides.findIndex((s) => s.id === dragSlideId);
    if (from < 0 || from === targetIndex) {
      setDragSlideId(null);
      return;
    }
    const next = [...slides];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved!);
    commit(next);
    setActiveIndex(targetIndex);
    setDragSlideId(null);
  };

  const slideTitlePreview = (s: EditorSlide, index: number) => {
    const t = s.elements.find((e) => e.type === "text" && e.role === "Title");
    return t && t.type === "text"
      ? t.content.slice(0, 42) || "Untitled"
      : `Slide ${index + 1}`;
  };

  if (deck.slides.length === 0 || slides.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-[var(--background)] p-8">
        <p className="max-w-sm text-center text-sm text-[var(--muted)]">
          No slides in this deck yet. Add an outline in content input, map
          templates, then return here.
        </p>
        <Link
          href="/create/content"
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Content
        </Link>
      </div>
    );
  }

  if (previewMode) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-zinc-950 text-white">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <p className="text-sm font-medium">Preview</p>
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm hover:bg-white/20"
          >
            <X className="size-4" />
            Exit preview
          </button>
        </header>
        <div className="flex flex-1 items-center justify-center bg-black p-8">
          <div className="w-full max-w-5xl">
            <SlideCanvas
              slide={activeSlide!}
              zoom={1}
              gridVisible={false}
              selectedId={null}
              onSelectElement={() => {}}
              onUpdateText={() => {}}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--background)]">
      {/* Top toolbar */}
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2">
        <ToolbarBtn
          label="Undo"
          onClick={undo}
          disabled={past.length === 0}
        >
          <Undo2 className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Redo"
          onClick={redo}
          disabled={future.length === 0}
        >
          <Redo2 className="size-4" />
        </ToolbarBtn>
        <div className="mx-1 h-6 w-px bg-[var(--border-subtle)]" />
        <ToolbarBtn
          label="Duplicate disabled — deck slide count follows the outline in Content"
          onClick={duplicateSlide}
          disabled
        >
          <Copy className="size-4" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Delete slide"
          onClick={deleteSlide}
          disabled={slides.length <= 1}
        >
          <Trash2 className="size-4" />
        </ToolbarBtn>
        <div className="mx-1 h-6 w-px bg-[var(--border-subtle)]" />
        <ToolbarBtn label="Preview" onClick={() => setPreviewMode(true)}>
          <Eye className="size-4" />
        </ToolbarBtn>
        <Link
          href="/preview"
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          title="Full-screen review and file export"
        >
          Review & export
          <ChevronRight className="size-3.5" />
        </Link>
        <ToolbarBtn label="Export" onClick={exportDeck}>
          <Download className="size-4" />
        </ToolbarBtn>
        <span className="ml-auto hidden text-xs text-[var(--muted)] sm:inline">
          Template-bound layout
        </span>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* LEFT thumbnails */}
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="border-b border-[var(--border-subtle)] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Slides
            </p>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-2">
            {slides.map((s, i) => (
              <li
                key={s.id}
                draggable
                onDragStart={() => onThumbDragStart(s.id)}
                onDragEnd={() => setDragSlideId(null)}
                onDragOver={onThumbDragOver}
                onDrop={() => onThumbDrop(i)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveIndex(i);
                    setSelectedElementId(null);
                  }}
                  className={cn(
                    "w-full rounded-lg border p-2 text-left transition-colors",
                    i === activeIndex
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/30"
                      : "border-[var(--border-subtle)] bg-[var(--background)] hover:border-[var(--muted)]/40",
                  )}
                >
                  <div
                    className="relative mb-2 aspect-video overflow-hidden rounded border border-[var(--border-subtle)] bg-white dark:bg-zinc-900"
                    style={{ fontSize: 5 }}
                  >
                    <div className="absolute inset-1 text-[6px] leading-tight text-zinc-800 dark:text-zinc-200">
                      {slideTitlePreview(s, i)}
                    </div>
                  </div>
                  <p className="line-clamp-2 text-[11px] font-medium leading-snug">
                    {slideTitlePreview(s, i)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                    Drag to reorder
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* CENTER */}
        <section className="relative flex min-w-0 flex-1 flex-col bg-[var(--surface-inset)]/30">
          <div className="flex shrink-0 items-center justify-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] py-2">
            <span className="text-xs text-[var(--muted)]">Zoom</span>
            <button
              type="button"
              aria-label="Zoom out"
              className="flex size-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]"
              onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
            >
              <Minus className="size-4" />
            </button>
            <span className="w-12 text-center text-xs tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              className="flex size-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]"
              onClick={() => setZoom((z) => Math.min(1.75, Math.round((z + 0.1) * 10) / 10))}
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setGridVisible((g) => !g)}
              className={cn(
                "ml-4 flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
                gridVisible
                  ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
              )}
            >
              <Grid3x3 className="size-3.5" />
              Grid
            </button>
          </div>
          <SlideCanvas
            slide={activeSlide}
            zoom={zoom}
            gridVisible={gridVisible}
            selectedId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onUpdateText={updateTextContent}
          />
        </section>

        {/* RIGHT properties */}
        <aside className="flex w-[min(340px,32vw)] min-w-[280px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="flex h-11 items-center border-b border-[var(--border-subtle)] px-4">
            <h2 className="text-sm font-semibold tracking-tight">Properties</h2>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {selectedText && !selectedText.locked && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Text
                </h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs text-[var(--muted)]">Font</label>
                    <select
                      value={selectedText.fontFamily}
                      onChange={(e) =>
                        updateElement(selectedText.id, {
                          fontFamily: e.target.value,
                        })
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.label} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[var(--muted)]">Size</label>
                      <input
                        type="number"
                        min={8}
                        max={96}
                        value={selectedText.fontSize}
                        onChange={(e) =>
                          updateElement(selectedText.id, {
                            fontSize: Number(e.target.value) || 12,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted)]">
                        Line height
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={1}
                        max={2.5}
                        value={selectedText.lineHeight}
                        onChange={(e) =>
                          updateElement(selectedText.id, {
                            lineHeight: Number(e.target.value) || 1.2,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm tabular-nums"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--muted)]">
                      Alignment
                    </label>
                    <div className="mt-1 flex gap-1">
                      {(
                        [
                          ["left", AlignLeft],
                          ["center", AlignCenter],
                          ["right", AlignRight],
                        ] as const
                      ).map(([al, Icon]) => (
                        <button
                          key={al}
                          type="button"
                          onClick={() =>
                            updateElement(selectedText.id, { align: al })
                          }
                          className={cn(
                            "flex flex-1 items-center justify-center rounded-lg border py-2",
                            selectedText.align === al
                              ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                              : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                          )}
                        >
                          <Icon className="size-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {selectedText?.locked && (
              <p className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
                This text is <strong className="text-foreground">template-locked</strong>
                . Edit unlocked fields on the canvas or adjust slide layout below.
              </p>
            )}

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Layout
              </h3>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-[var(--muted)]">
                    Padding (template inset)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={120}
                    value={activeSlide.padding}
                    onChange={(e) =>
                      updateSlide({
                        padding: Number(e.target.value) || 48,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">
                    Block spacing
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={48}
                    value={activeSlide.spacing}
                    onChange={(e) =>
                      updateSlide({
                        spacing: Number(e.target.value) || 12,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--muted)]">
                    Slide alignment
                  </label>
                  <div className="mt-1 flex gap-1">
                    {(
                      [
                        ["left", AlignLeft],
                        ["center", AlignCenter],
                        ["right", AlignRight],
                      ] as const
                    ).map(([al, Icon]) => (
                      <button
                        key={al}
                        type="button"
                        onClick={() => updateSlide({ align: al as TextAlign })}
                        className={cn(
                          "flex flex-1 items-center justify-center rounded-lg border py-2",
                          activeSlide.align === al
                            ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                            : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                        )}
                      >
                        <Icon className="size-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Elements
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ElementAddBtn
                  icon={ImageIcon}
                  label="Image"
                  onClick={() => addPlaceholder("image", "Image")}
                />
                <ElementAddBtn
                  icon={BarChart3}
                  label="Chart"
                  onClick={() => addPlaceholder("chart", "Chart")}
                />
                <ElementAddBtn
                  icon={Shapes}
                  label="Shape"
                  onClick={() => addPlaceholder("shape", "Shape")}
                />
                <ElementAddBtn
                  icon={Sparkles}
                  label="Icon"
                  onClick={() => addPlaceholder("icon", "Icon")}
                />
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Template constraints
              </h3>
              <ul className="mt-2 space-y-2">
                {activeSlide.elements.map((el) => (
                  <li
                    key={el.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
                      selectedElementId === el.id
                        ? "border-[var(--accent)]/50 bg-[var(--accent-muted)]/40"
                        : "border-[var(--border-subtle)] bg-[var(--background)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedElementId(el.id)}
                      className="min-w-0 flex-1 text-left font-medium"
                    >
                      <span className="block truncate">{el.role}</span>
                      <span className="text-[10px] font-normal text-[var(--muted)]">
                        {el.type === "text" ? "Text" : el.placeholderKind}
                      </span>
                    </button>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase",
                        el.locked
                          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400",
                      )}
                    >
                      {el.locked ? "Locked" : "Editable"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ElementAddBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ImageIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] py-3 text-xs font-medium transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-inset)]"
    >
      <Icon className="size-5 text-[var(--muted)]" strokeWidth={1.75} />
      {label}
    </button>
  );
}
