import type { SlideTemplateDefinition, TemplateRegion } from "./types";

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Smaller regions draw last so titles / callouts read on top. */
function regionsByPaintOrder(regions: TemplateRegion[]) {
  return [...regions].sort((a, b) => a.w * a.h - b.w * b.h);
}

function TemplateRegionThumb({
  region: r,
  photoUnder,
}: {
  region: TemplateRegion;
  photoUnder: boolean;
}) {
  const box = {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  } as const;

  const lineCount = Math.min(6, Math.max(2, Math.round(r.h * 14)));

  if (r.kind !== "text") {
    const roundClass =
      r.kind === "shape" && r.shapeVariant === "circle"
        ? "rounded-full"
        : "rounded-[2px]";
    return (
      <div
        className={cn(
          "pointer-events-none absolute overflow-hidden border shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)]",
          photoUnder
            ? "border-white/40 bg-black/20 dark:border-white/25 dark:bg-black/35"
            : "border-zinc-900/[0.07] dark:border-white/[0.12]",
          roundClass,
        )}
        style={box}
        title={r.label}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100/90 via-indigo-100/70 to-amber-50/90 dark:from-sky-950/80 dark:via-indigo-950/70 dark:to-amber-950/50" />
        <div
          className="absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full bg-gradient-to-br from-white/55 to-transparent dark:from-white/10"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.22] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-12deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 3px)",
          }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/[0.08] to-transparent dark:from-black/35" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden rounded-[2px] border px-[6%] py-[7%] shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
        photoUnder
          ? "border-white/35 bg-white/72 dark:border-white/20 dark:bg-zinc-950/55"
          : "border-zinc-900/[0.06] bg-white/92 dark:border-white/[0.08] dark:bg-zinc-900/88",
      )}
      style={box}
      title={r.label}
    >
      <div className="flex h-full flex-col justify-center gap-y-[3px]">
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            className="h-[2px] max-w-full shrink-0 rounded-full bg-zinc-800/22 dark:bg-white/28"
            style={{
              width: `${Math.max(28, 100 - i * (r.w > 0.55 ? 8 : 11))}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Miniature 16×9 slide preview from layout regions (gallery + sidebars). */
export function SlideLayoutThumb({ slide }: { slide: SlideTemplateDefinition }) {
  const ordered = regionsByPaintOrder(slide.regions);
  const photo = slide.slidePreviewDataUrl;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-gradient-to-br from-zinc-100 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900"
      title={slide.name}
    >
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from PPTX import */}
          <img
            src={photo}
            alt=""
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain bg-zinc-950"
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-black/[0.04] dark:bg-black/20"
            aria-hidden
          />
        </>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.2] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
            backgroundSize: "12px 12px",
          }}
          aria-hidden
        />
      )}
      {ordered.map((r) => (
        <TemplateRegionThumb
          key={r.id}
          region={r}
          photoUnder={Boolean(photo)}
        />
      ))}
    </div>
  );
}
