"use client";

import { BarChart3, ImageIcon, Shapes, Sparkles } from "lucide-react";
import type {
  EditorElement,
  EditorSlide,
  EditorTextElement,
  PlaceholderKind,
} from "@/components/editor/types";

export const READONLY_SLIDE_W = 960;
export const READONLY_SLIDE_H = 540;

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

const PH_ICONS: Record<PlaceholderKind, typeof ImageIcon> = {
  image: ImageIcon,
  chart: BarChart3,
  shape: Shapes,
  icon: Sparkles,
};

type DeckSlideReadonlyPreviewProps = {
  slide: EditorSlide;
  /** Bump to replay CSS enter animation */
  transitionKey?: number;
  className?: string;
};

/**
 * Renders one slide from the same `EditorSlide` model as the editor (template metadata + content).
 * Used in Map and Preview so the UI matches the selected template JSON, not hardcoded presets.
 */
export function DeckSlideReadonlyPreview({
  slide,
  transitionKey = 0,
  className,
}: DeckSlideReadonlyPreviewProps) {
  return (
    <div
      key={transitionKey}
      className={cn(
        "mapping-preview-enter relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-lg dark:bg-zinc-950",
        className,
      )}
      style={{ maxWidth: READONLY_SLIDE_W }}
    >
      <div
        className="relative mx-auto overflow-hidden bg-white dark:bg-zinc-950"
        style={{
          width: READONLY_SLIDE_W,
          height: READONLY_SLIDE_H,
        }}
      >
        {slide.backgroundImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.backgroundImageUrl}
            alt=""
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain"
            draggable={false}
          />
        ) : null}
        <div
          className="pointer-events-none absolute z-[1] rounded-md border border-dashed border-[var(--accent)]/30"
          style={{
            top: slide.padding,
            left: slide.padding,
            right: slide.padding,
            bottom: slide.padding,
          }}
        />
        <div className="relative z-[2] h-full w-full">
          {slide.elements.map((el) => (
            <ReadonlyElement key={el.id} el={el} slideAlign={slide.align} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadonlyElement({
  el,
  slideAlign,
}: {
  el: EditorElement;
  slideAlign: EditorSlide["align"];
}) {
  const box = {
    position: "absolute" as const,
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
  };

  if (el.type === "placeholder") {
    const Icon = PH_ICONS[el.placeholderKind];
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-zinc-400/50 bg-zinc-50/75 dark:border-zinc-500 dark:bg-zinc-900/40"
        style={box}
      >
        <Icon className="size-5 opacity-45" strokeWidth={1.5} />
        <span className="px-1 text-center text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {el.label}
        </span>
      </div>
    );
  }

  const textEl = el as EditorTextElement;
  const align = textEl.align || slideAlign;

  return (
    <div
      className="overflow-hidden rounded-sm"
      style={{
        ...box,
        padding: 4,
        textAlign: align,
      }}
    >
      <div
        className="h-full w-full whitespace-pre-wrap text-zinc-900 dark:text-zinc-100"
        style={{
          fontFamily: textEl.fontFamily,
          fontSize: textEl.fontSize,
          lineHeight: textEl.lineHeight,
        }}
      >
        {textEl.content}
      </div>
    </div>
  );
}
