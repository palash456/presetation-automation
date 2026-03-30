import type { EditorSlide } from "@/components/editor/types";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import { buildEditorSlidesFromDeck } from "./helpers";
import type { DeckDocument } from "./types";

/** Prefer saved canvas; otherwise SlideModel-driven layout (requires active pack). */
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
  return buildEditorSlidesFromDeck(deck, company);
}
