import type { DeckDocument } from "./types";

/** Structured view of deck content for APIs / debugging (single source: `deck.slides`). */
export type StructuredDeckSlide = {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  assignedTemplateId: string;
};

export type StructuredDeckContent = {
  deckTitle: string;
  activeCompanyTemplateId: string | null;
  slides: StructuredDeckSlide[];
};

export function deckToStructuredContent(deck: DeckDocument): StructuredDeckContent {
  return {
    deckTitle: deck.title,
    activeCompanyTemplateId: deck.activeCompanyTemplateId,
    slides: deck.slides.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      bullets: [...s.bullets],
      assignedTemplateId: s.assignedTemplateId,
    })),
  };
}
