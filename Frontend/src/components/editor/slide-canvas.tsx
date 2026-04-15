"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { BarChart3, ImageIcon, Lock, Shapes, Sparkles } from "lucide-react";
import type {
  EditorElement,
  EditorSlide,
  EditorTextElement,
  PlaceholderKind,
} from "./types";

type SlideAlign = EditorSlide["align"];

const SLIDE_W = 960;
const SLIDE_H = 540;

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

const PH_ICONS: Record<PlaceholderKind, typeof ImageIcon> = {
  image: ImageIcon,
  chart: BarChart3,
  shape: Shapes,
  icon: Sparkles,
};

type SlideCanvasProps = {
  slide: EditorSlide;
  zoom: number;
  gridVisible: boolean;
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateText: (id: string, content: string) => void;
};

export function SlideCanvas({
  slide,
  zoom,
  gridVisible,
  selectedId,
  onSelectElement,
  onUpdateText,
}: SlideCanvasProps) {
  const clearSelectionIfBackground = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onSelectElement(null);
    },
    [onSelectElement],
  );

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          transition: "transform 0.2s ease-out",
        }}
      >
        <div
          className="relative overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
          style={{ width: SLIDE_W, height: SLIDE_H }}
        >
          {slide.backgroundImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URLs from template import
            <img
              src={slide.backgroundImageUrl}
              alt=""
              className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain"
              draggable={false}
            />
          ) : null}
          {/* Template rails (smart inset) */}
          <div
            className="pointer-events-none absolute z-[1] rounded-md border border-dashed border-[var(--accent)]/35"
            style={{
              top: slide.padding,
              left: slide.padding,
              right: slide.padding,
              bottom: slide.padding,
            }}
          />

          {gridVisible && (
            <div
              className="pointer-events-none absolute inset-0 z-[1] opacity-[0.2] dark:opacity-15"
              style={{
                backgroundImage: `
                  linear-gradient(to right, var(--border-subtle) 1px, transparent 1px),
                  linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)
                `,
                backgroundSize: "24px 24px",
              }}
            />
          )}

          <div
            className="relative z-[2] h-full w-full"
            onMouseDown={clearSelectionIfBackground}
          >
            {slide.elements.map((el) => (
              <ElementView
                key={el.id}
                el={el}
                selected={selectedId === el.id}
                slideAlign={slide.align}
                onSelect={() => onSelectElement(el.id)}
                onUpdateText={onUpdateText}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ElementView({
  el,
  selected,
  slideAlign,
  onSelect,
  onUpdateText,
}: {
  el: EditorElement;
  selected: boolean;
  slideAlign: SlideAlign;
  onSelect: () => void;
  onUpdateText: (id: string, content: string) => void;
}) {
  const commonBox = {
    position: "absolute" as const,
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
  };

  if (el.type === "placeholder") {
    const Icon = PH_ICONS[el.placeholderKind];
    return (
      <button
        type="button"
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed transition-shadow",
          el.locked
            ? "cursor-default border-zinc-300/80 bg-zinc-100/50 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400"
            : "cursor-pointer border-zinc-400/60 bg-zinc-50/80 hover:border-[var(--accent)]/50 dark:border-zinc-500 dark:bg-zinc-900/30",
          selected && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-950",
        )}
        style={commonBox}
      >
        {el.locked && (
          <Lock
            className="absolute right-1 top-1 size-3 text-[var(--muted)]"
            strokeWidth={2}
            aria-hidden
          />
        )}
        <Icon className="size-6 opacity-50" strokeWidth={1.5} />
        <span className="text-[10px] font-medium uppercase tracking-wide">
          {el.label}
        </span>
      </button>
    );
  }

  const textEl = el;
  const effectiveAlign = textEl.align || slideAlign;

  return (
    <div
      className={cn(
        "group rounded-md transition-shadow",
        selected && "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-white dark:ring-offset-zinc-950",
        textEl.locked && "ring-1 ring-zinc-300/60 dark:ring-zinc-600/50",
      )}
      style={{
        ...commonBox,
        padding: 4,
        textAlign: effectiveAlign,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {textEl.locked && (
        <div className="pointer-events-none absolute -left-0.5 -top-0.5 z-10 flex items-center gap-0.5 rounded bg-zinc-200/90 px-1 py-0.5 dark:bg-zinc-800/90">
          <Lock className="size-2.5 text-[var(--muted)]" aria-hidden />
          <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Template
          </span>
        </div>
      )}
      {textEl.locked ? (
        <div
          className="h-full w-full cursor-default whitespace-pre-wrap text-zinc-800 opacity-85 dark:text-zinc-100"
          style={{
            fontFamily: textEl.fontFamily,
            fontSize: textEl.fontSize,
            lineHeight: textEl.lineHeight,
          }}
        >
          {textEl.content}
        </div>
      ) : (
        <EditableTextBlock
          key={textEl.id}
          textEl={textEl}
          onUpdateText={onUpdateText}
        />
      )}
    </div>
  );
}

function EditableTextBlock({
  textEl,
  onUpdateText,
}: {
  textEl: EditorTextElement;
  onUpdateText: (id: string, content: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (document.activeElement === node) return;
    node.textContent = textEl.content;
  }, [textEl.id, textEl.content]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="h-full min-h-[1.5em] w-full cursor-text whitespace-pre-wrap outline-none hover:bg-[var(--accent-muted)]/20 focus:bg-transparent dark:hover:bg-[var(--accent-muted)]/15"
      style={{
        fontFamily: textEl.fontFamily,
        fontSize: textEl.fontSize,
        lineHeight: textEl.lineHeight,
      }}
      onBlur={(e) => onUpdateText(textEl.id, e.currentTarget.textContent ?? "")}
    />
  );
}

export { SLIDE_W, SLIDE_H };
