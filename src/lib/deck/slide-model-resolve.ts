import type { CompanyTemplate } from "@/components/template-system/company-types";
import type { SlideModel } from "@/core/types";
import { rebuildSlideModelsFromDeckSlides } from "./slide-model-bridge";
import type { DeckDocument } from "./types";

/**
 * Returns aligned slide models for the deck: persisted `slideModels`, or a
 * fresh template-first remap when a company pack is active but models are
 * missing (e.g. legacy storage).
 */
export function resolveSlideModelsForDeck(
  deck: DeckDocument,
  company: CompanyTemplate | null,
): SlideModel[] | null {
  if (!company || company.slideTemplates.length === 0 || deck.slides.length === 0) {
    return null;
  }
  if (deck.slideModels && deck.slideModels.length === deck.slides.length) {
    return deck.slideModels;
  }
  return rebuildSlideModelsFromDeckSlides(deck.slides, company).models;
}
