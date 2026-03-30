import type { EditorSlide } from "@/components/editor/types";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import { companyTemplateToTemplate } from "@/core/adapter/company-to-template";
import { slideModelsToEditorSlides } from "@/core/layout/slide-model-to-editor-slide";
import { buildEditorSlidesFromDeck } from "./helpers";
import { resolveSlideModelsForDeck } from "./slide-model-resolve";
import type { DeckDocument } from "./types";

/** Prefer saved canvas; then template-first models; then remap legacy decks; else generic layout. */
export function getExportEditorSlidesForDeck(
  deck: DeckDocument,
  company: CompanyTemplate | null,
): EditorSlide[] {
  const lenOk =
    deck.editorSlides != null &&
    deck.editorSlides.length === deck.slides.length;
  if (lenOk) {
    return JSON.parse(JSON.stringify(deck.editorSlides)) as EditorSlide[];
  }

  const models = resolveSlideModelsForDeck(deck, company);
  if (models && models.length === deck.slides.length && company) {
    const template = companyTemplateToTemplate(company);
    return slideModelsToEditorSlides(models, template);
  }

  return buildEditorSlidesFromDeck(deck.slides, company);
}
