import type { SlideContent, SlideType } from "./types";

const DEFAULT_LIMITS = {
  title: 72,
  subtitle: 140,
  bulletLine: 96,
  notes: 480,
} as const;

function inferTypeFromIndex(i: number, firstLine: string): SlideType {
  if (i === 0) return "title";
  if (/^agenda|^outline|^overview/i.test(firstLine)) return "section";
  if (/vs\.|versus|compare/i.test(firstLine)) return "comparison";
  if (/\d+%|\$\d|kpi|metric/i.test(firstLine)) return "data";
  if (/thank|q\s*&\s*a|closing/i.test(firstLine)) return "closing";
  return "content";
}

/** Build slides from pasted or AI-generated plain text (paragraphs → slides). */
export function slidesFromPlainText(text: string): SlideContent[] {
  const chunks = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const paras = chunks.length ? chunks : [text.trim() || "Untitled deck"];

  return paras.slice(0, 12).map((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] ?? `Slide ${i + 1}`;
    const rest = lines.slice(1);
    const subtitle = rest[0] && !rest[0].startsWith("•") && !rest[0].startsWith("-")
      ? rest.shift()!
      : "";
    const bulletLines = rest.length
      ? rest
      : i > 0
        ? ["Add supporting points for this slide."]
        : [];
    const bullets = bulletLines.map((l) =>
      l.replace(/^[-•*]\s*/, "").trim(),
    );

    const st = inferTypeFromIndex(i, title);
    const scoreBase =
      st === "title" ? 92 : st === "content" ? 78 : st === "data" ? 71 : 74;
    const score = Math.min(99, scoreBase - i * 2 + (title.length % 7));

    return {
      id: `slide-${i + 1}-${Date.now().toString(36)}`,
      title,
      subtitle,
      bullets: bullets.length ? bullets : [],
      notes: "",
      mediaPlaceholders:
        st === "title"
          ? ["Hero image"]
          : st === "data"
            ? ["Chart or table"]
            : st === "comparison"
              ? ["Left visual", "Right visual"]
              : [],
      slideType: st,
      templateMatchScore: score,
      limits: { ...DEFAULT_LIMITS },
    };
  });
}
