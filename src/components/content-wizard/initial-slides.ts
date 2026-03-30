import type { SlideContent } from "./types";

const DEFAULT_LIMITS = {
  title: 72,
  subtitle: 140,
  bulletLine: 96,
  notes: 480,
} as const;

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

    const score = Math.min(99, 78 - i * 2 + (title.length % 7));

    return {
      id: `slide-${i + 1}-${Date.now().toString(36)}`,
      title,
      subtitle,
      bullets: bullets.length ? bullets : [],
      notes: "",
      mediaPlaceholders: i === 0 ? ["Hero image"] : ["Supporting visual"],
      templateMatchScore: score,
      limits: { ...DEFAULT_LIMITS },
    };
  });
}
