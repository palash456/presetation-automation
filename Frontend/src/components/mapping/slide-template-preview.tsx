"use client";

type PreviewSlide = {
  title: string;
  subtitle: string;
  bullets: string[];
};

/** Legacy placeholder; prefer pack-driven editor preview for layout fidelity. */
export function SlideTemplatePreview({
  templateSlideId,
  slide,
  transitionKey,
}: {
  templateSlideId: string;
  slide: PreviewSlide;
  transitionKey: number;
}) {
  return (
    <div
      key={`${templateSlideId}-${transitionKey}`}
      className="mapping-preview-enter relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white shadow-lg dark:bg-zinc-950"
    >
      <ClassicLayout slide={slide} />
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
            <li
              key={i}
              className="flex gap-2 border-l-2 border-zinc-300 pl-3 dark:border-zinc-600"
            >
              {b}
            </li>
          ))}
        </ul>
        <div className="w-[32%] shrink-0 rounded-lg border border-dashed border-zinc-300 bg-white/80 dark:border-zinc-600 dark:bg-zinc-800/50" />
      </div>
    </div>
  );
}
