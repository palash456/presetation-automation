"use client";

import type { TemplatePresetId } from "./types";

type PreviewSlide = {
  title: string;
  subtitle: string;
  bullets: string[];
};

export function SlideTemplatePreview({
  templateId,
  slide,
  transitionKey,
}: {
  templateId: TemplatePresetId;
  slide: PreviewSlide;
  /** Bump to replay enter animation */
  transitionKey: number;
}) {
  return (
    <div
      key={`${templateId}-${transitionKey}`}
      className="mapping-preview-enter relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-lg dark:bg-zinc-950"
    >
      {templateId === "title-hero" && (
        <HeroLayout slide={slide} />
      )}
      {templateId === "content-classic" && (
        <ClassicLayout slide={slide} />
      )}
      {templateId === "comparison-split" && (
        <CompareLayout slide={slide} />
      )}
      {templateId === "data-focus" && (
        <DataLayout slide={slide} />
      )}
      {templateId === "section-minimal" && (
        <SectionLayout slide={slide} />
      )}
    </div>
  );
}

function HeroLayout({ slide }: { slide: PreviewSlide }) {
  return (
    <div className="flex h-full bg-gradient-to-br from-indigo-50 to-white p-[8%] dark:from-indigo-950/40 dark:to-zinc-950">
      <div className="flex w-[55%] flex-col justify-center pr-4">
        <h2 className="text-[clamp(1.25rem,3.5vw,2.25rem)] font-bold leading-tight tracking-tight text-indigo-950 dark:text-indigo-100">
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="mt-3 text-[clamp(0.75rem,1.6vw,1rem)] text-indigo-800/80 dark:text-indigo-200/80">
            {slide.subtitle}
          </p>
        )}
        <ul className="mt-4 space-y-1.5 text-[clamp(0.65rem,1.3vw,0.875rem)] text-zinc-700 dark:text-zinc-300">
          {slide.bullets.slice(0, 3).map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-indigo-500">●</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative flex w-[45%] items-center justify-center">
        <div className="aspect-[4/5] w-[85%] rounded-xl bg-gradient-to-b from-indigo-200/60 to-indigo-400/30 dark:from-indigo-500/20 dark:to-indigo-800/30" />
        <span className="absolute bottom-4 text-[10px] font-medium uppercase tracking-wider text-indigo-600/70 dark:text-indigo-300/60">
          Image
        </span>
      </div>
    </div>
  );
}

function ClassicLayout({ slide }: { slide: PreviewSlide }) {
  return (
    <div className="flex h-full flex-col bg-zinc-50 p-[7%] dark:bg-zinc-900">
      <h2 className="text-[clamp(1.1rem,2.8vw,1.75rem)] font-bold text-zinc-900 dark:text-zinc-50">
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p className="mt-2 text-[clamp(0.7rem,1.4vw,0.9rem)] text-zinc-600 dark:text-zinc-400">
          {slide.subtitle}
        </p>
      )}
      <div className="mt-5 flex flex-1 gap-[6%]">
        <ul className="flex-1 space-y-2.5 text-[clamp(0.65rem,1.25vw,0.8rem)] leading-snug text-zinc-800 dark:text-zinc-200">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 border-l-2 border-zinc-300 pl-3 dark:border-zinc-600">
              {b}
            </li>
          ))}
        </ul>
        <div className="w-[32%] shrink-0 rounded-lg border border-dashed border-zinc-300 bg-white/80 dark:border-zinc-600 dark:bg-zinc-800/50" />
      </div>
    </div>
  );
}

function CompareLayout({ slide }: { slide: PreviewSlide }) {
  const [a, b, ...rest] = slide.bullets;
  return (
    <div className="flex h-full flex-col bg-slate-50 p-[6%] dark:bg-slate-950">
      <h2 className="text-center text-[clamp(1rem,2.4vw,1.5rem)] font-bold text-slate-900 dark:text-slate-100">
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p className="mt-1 text-center text-xs text-slate-600 dark:text-slate-400">
          {slide.subtitle}
        </p>
      )}
      <div className="mt-4 grid flex-1 grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
            A
          </p>
          <p className="mt-2 text-[clamp(0.65rem,1.2vw,0.8rem)] leading-relaxed text-slate-800 dark:text-slate-200">
            {a ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
            B
          </p>
          <p className="mt-2 text-[clamp(0.65rem,1.2vw,0.8rem)] leading-relaxed text-slate-800 dark:text-slate-200">
            {b ?? "—"}
          </p>
        </div>
      </div>
      {rest.length > 0 && (
        <p className="mt-2 text-center text-[10px] text-amber-700 dark:text-amber-400">
          +{rest.length} more lines — may wrap in strict split layout
        </p>
      )}
    </div>
  );
}

function DataLayout({ slide }: { slide: PreviewSlide }) {
  return (
    <div className="flex h-full flex-col bg-emerald-50/80 p-[6%] dark:bg-emerald-950/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[clamp(1rem,2.2vw,1.4rem)] font-bold text-emerald-950 dark:text-emerald-100">
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="mt-1 text-[clamp(0.65rem,1.2vw,0.85rem)] font-medium text-emerald-800 dark:text-emerald-300">
              {slide.subtitle}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          KPI
        </div>
      </div>
      <div className="mt-4 flex flex-1 gap-4">
        <div className="flex flex-1 flex-col justify-center space-y-2">
          {slide.bullets.map((b, i) => (
            <div
              key={i}
              className="rounded-lg bg-white/90 px-3 py-2 text-[clamp(0.6rem,1.1vw,0.75rem)] font-medium text-emerald-900 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-100"
            >
              {b}
            </div>
          ))}
        </div>
        <div className="flex w-[44%] flex-col justify-end">
          <div className="aspect-[4/3] w-full rounded-lg bg-gradient-to-t from-emerald-200/80 to-emerald-100/40 dark:from-emerald-800/40 dark:to-emerald-900/20" />
          <span className="mt-1 text-center text-[9px] font-medium uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/50">
            Chart
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionLayout({ slide }: { slide: PreviewSlide }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-zinc-100 px-[12%] dark:bg-zinc-900">
      <div className="h-1 w-16 rounded-full bg-[var(--accent)]" />
      <h2 className="mt-6 text-center text-[clamp(1.25rem,3.2vw,2rem)] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {slide.subtitle}
        </p>
      )}
    </div>
  );
}
