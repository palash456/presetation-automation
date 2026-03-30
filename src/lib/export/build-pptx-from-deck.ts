import type { CompanyTemplate } from "@/components/template-system/company-types";
import type { DeckDocument } from "@/lib/deck/types";
import { getExportEditorSlidesForDeck } from "@/lib/deck/export-editor-slides";

const SLIDE_W_IN = 10;
const SLIDE_H_IN = 5.625;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

/**
 * Builds a .pptx from the deck + template metadata (browser only).
 * Uses pptxgenjs: text boxes and optional slide background images from template import.
 */
export async function downloadDeckAsPptx(
  deck: DeckDocument,
  company: CompanyTemplate | null,
): Promise<void> {
  const pptxgen = (await import("pptxgenjs")).default;
  const editorSlides = getExportEditorSlidesForDeck(deck, company);

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.title.trim() || "Presentation";
  pptx.author = "Present";

  for (const es of editorSlides) {
    const slide = pptx.addSlide();

    if (es.backgroundImageUrl) {
      slide.addImage({
        data: dataUrlToBase64(es.backgroundImageUrl),
        x: 0,
        y: 0,
        w: SLIDE_W_IN,
        h: SLIDE_H_IN,
      });
    } else {
      slide.background = { color: "FFFFFF" };
    }

    for (const el of es.elements) {
      const x = (el.x / 100) * SLIDE_W_IN;
      const y = (el.y / 100) * SLIDE_H_IN;
      const w = (el.w / 100) * SLIDE_W_IN;
      const h = (el.h / 100) * SLIDE_H_IN;

      if (el.type === "text") {
        const text = truncate(
          el.content,
          el.role === "Body" ? 3000 : 800,
        ).trim();
        if (!text) continue;
        slide.addText(text, {
          x,
          y,
          w,
          h,
          fontSize: Math.max(8, Math.min(40, Math.round(el.fontSize * 0.85))),
          fontFace: "Arial",
          color: "2D2D2D",
          valign: "top",
          align:
            el.align === "center"
              ? "center"
              : el.align === "right"
                ? "right"
                : "left",
          margin: 3,
          wrap: true,
        });
      } else {
        slide.addText(`[${el.label}]`, {
          x,
          y,
          w,
          h,
          fontSize: 9,
          color: "888888",
          valign: "middle",
          align: "center",
          italic: true,
        });
      }
    }
  }

  const safe = (deck.title || "presentation")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim()
    .slice(0, 80);
  await pptx.writeFile({ fileName: `${safe || "presentation"}.pptx` });
}
