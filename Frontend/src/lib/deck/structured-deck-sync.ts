import type { StructuredContent } from "@/core/types";
import type { DeckSlide } from "./types";
import { structuredContentFromDeckSlides } from "@/core/parser/structured-from-deck-slides";

/** One wizard row → section (matches compact row shape). */
export function sectionFromDeckSlide(s: DeckSlide): StructuredContent["sections"][0] {
  return {
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
  };
}

/** Keep `structuredContent.sections` aligned with a row after outline edit. */
export function replaceStructuredSectionForSlide(
  structured: StructuredContent,
  slideIndex: number,
  slide: DeckSlide,
): StructuredContent {
  const sections = structured.sections.slice();
  if (slideIndex < 0 || slideIndex >= sections.length) {
    return structured;
  }
  sections[slideIndex] = sectionFromDeckSlide(slide);
  return {
    ...structured,
    sections,
  };
}

/** Transitional: derive structured from flat slides when missing. */
export function structuredContentForDeck(
  slides: DeckSlide[],
  existing: StructuredContent | null,
): StructuredContent {
  if (
    existing &&
    existing.sections.length === slides.length &&
    slides.length > 0
  ) {
    return existing;
  }
  return structuredContentFromDeckSlides(slides);
}
