import { loadTemplateLibrary } from "@/components/template-system/template-library-storage";
import { rebuildSlideModelsFromDeckSlides } from "./slide-model-bridge";
import type { DeckDocument } from "./types";

/**
 * Backfills `slideModels` (and mapping-aligned `slides`) when local storage
 * predates template-first persistence but the deck already has an active pack.
 */
export function deckWithSlideModelsHydrated(doc: DeckDocument): {
  deck: DeckDocument;
  changed: boolean;
} {
  const modelsOk =
    doc.slideModels != null && doc.slideModels.length === doc.slides.length;
  if (doc.slides.length === 0 || modelsOk || !doc.activeCompanyTemplateId) {
    return { deck: doc, changed: false };
  }

  const company =
    loadTemplateLibrary().find((c) => c.id === doc.activeCompanyTemplateId) ??
    null;
  if (!company || company.slideTemplates.length === 0) {
    return { deck: doc, changed: false };
  }

  const rebuilt = rebuildSlideModelsFromDeckSlides(
    doc.slides,
    company,
    doc.structuredContent,
  );
  return {
    deck: {
      ...doc,
      slides: rebuilt.slides,
      slideModels: rebuilt.models,
      structuredContent: rebuilt.structured,
    },
    changed: true,
  };
}
