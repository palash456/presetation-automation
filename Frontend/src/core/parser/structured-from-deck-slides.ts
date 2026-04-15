import type { DeckSlide } from "@/lib/deck/types";
import type { StructuredContent } from "../types";

/** Reconstruct structured content from current deck slides (remap / template switch). */
export function structuredContentFromDeckSlides(slides: DeckSlide[]): StructuredContent {
  if (slides.length === 0) {
    return { title: undefined, sections: [] };
  }
  return {
    title: slides[0]?.title,
    sections: slides.map((s) => ({
      heading: s.title,
      blocks: [
        ...(s.subtitle.trim()
          ? [{ type: "paragraph" as const, text: s.subtitle.trim() }]
          : []),
        ...(s.bullets.length > 0
          ? [{ type: "bullets" as const, items: [...s.bullets] }]
          : []),
        ...(s.notes.trim()
          ? [{ type: "paragraph" as const, text: s.notes.trim() }]
          : []),
      ],
    })),
  };
}
