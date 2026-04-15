import type { SlideContent } from "@/components/content-wizard/types";
import type { StructuredContent } from "../types";
import { normalizeStructuredContent } from "../normalizer/normalize-structured-content";

const DEFAULT_LIMITS = {
  title: 72,
  subtitle: 140,
  bulletLine: 96,
  notes: 480,
} as const;

/** Minimal SlideContent rows for deck storage / wizard (one row per section). */
export function slideContentRowsFromStructured(
  structured: StructuredContent,
): SlideContent[] {
  const n = normalizeStructuredContent(structured);
  const ts = Date.now().toString(36);
  return n.sections.map((sec, i) => {
    const paragraphs = sec.blocks.filter((b) => b.type === "paragraph");
    const bulletsBlock = sec.blocks.find((b) => b.type === "bullets");
    const subtitle =
      paragraphs[0] && paragraphs[0].type === "paragraph"
        ? paragraphs[0].text
        : "";
    const extraParagraphs = paragraphs.slice(1);
    const bullets =
      bulletsBlock && bulletsBlock.type === "bullets"
        ? [...bulletsBlock.items]
        : [];
    const notes = extraParagraphs
      .map((p) => (p.type === "paragraph" ? p.text : ""))
      .filter(Boolean)
      .join("\n\n");

    return {
      id: `slide-${i}-${ts}`,
      title: sec.heading,
      subtitle,
      bullets,
      notes,
      mediaPlaceholders: [],
      templateMatchScore: Math.max(55, 90 - i * 3),
      limits: { ...DEFAULT_LIMITS },
    } satisfies SlideContent;
  });
}
