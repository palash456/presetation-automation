import type { CompanyTemplate } from "@/components/template-system/company-types";
import { companyTemplateToTemplate, findTemplateSlide } from "@/core/adapter/company-to-template";
import type { SlideModel, TemplateRegionRole } from "@/core/types";
import { resolveSlideModelsForDeck } from "@/lib/deck/slide-model-resolve";
import type { DeckDocument } from "@/lib/deck/types";

const SLIDE_W_IN = 10;
const SLIDE_H_IN = 5.625;

/** Matches `slide-model-to-editor-slide` so export boxes align with preview. */
function fontSizePtForRegion(role: TemplateRegionRole, hNorm: number): number {
  const h = Math.max(0.02, hNorm);
  if (role === "title") return Math.min(44, Math.max(18, Math.round(10 + h * 85)));
  if (role === "footer") return Math.min(14, Math.max(10, Math.round(6 + h * 40)));
  return Math.min(22, Math.max(11, Math.round(7 + h * 55)));
}

function alignForRole(_role: TemplateRegionRole): "left" | "center" | "right" {
  return "left";
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function regionTextForPptx(model: SlideModel, regionId: string): string {
  const payload = model.regions.find((r) => r.regionId === regionId);
  const raw = payload?.content ?? "";
  return Array.isArray(raw) ? raw.join("\n") : String(raw);
}

/**
 * Builds a .pptx from SlideModel[] + template regions (same source as preview).
 * Skips text on `image` regions when a slide background image exists — avoids
 * duplicating template art as editable text on top of the preview PNG.
 */
export async function downloadDeckAsPptx(
  deck: DeckDocument,
  company: CompanyTemplate | null,
): Promise<void> {
  const pptxgen = (await import("pptxgenjs")).default;
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = deck.title.trim() || "Presentation";
  pptx.author = "Present";

  if (deck.slides.length === 0) {
    pptx.addSlide();
    const safe = (deck.title || "presentation")
      .replace(/[/\\?%*:|"<>]/g, "-")
      .trim()
      .slice(0, 80);
    await pptx.writeFile({ fileName: `${safe || "presentation"}.pptx` });
    return;
  }

  if (!company || company.slideTemplates.length === 0) {
    throw new Error("Template required");
  }

  const models = resolveSlideModelsForDeck(deck, company);
  if (!models || models.length !== deck.slides.length) {
    throw new Error("Template required");
  }

  const template = companyTemplateToTemplate(company);

  for (const model of models) {
    const ts = findTemplateSlide(template, model.templateSlideId);
    if (!ts) {
      throw new Error("Template required");
    }

    const slide = pptx.addSlide();
    const hasBg = Boolean(ts.slidePreviewDataUrl);

    if (hasBg && ts.slidePreviewDataUrl) {
      slide.addImage({
        data: dataUrlToBase64(ts.slidePreviewDataUrl),
        x: 0,
        y: 0,
        w: SLIDE_W_IN,
        h: SLIDE_H_IN,
      });
    } else {
      slide.background = { color: "FFFFFF" };
    }

    for (const tr of ts.regions) {
      if (tr.role === "image") {
        if (!hasBg) {
          const x = tr.layout.x * SLIDE_W_IN;
          const y = tr.layout.y * SLIDE_H_IN;
          const w = tr.layout.w * SLIDE_W_IN;
          const h = tr.layout.h * SLIDE_H_IN;
          slide.addText("[Image]", {
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
        continue;
      }

      const text = truncate(
        regionTextForPptx(model, tr.id),
        tr.role === "body" ? 3000 : 800,
      ).trim();
      if (!text) continue;

      const x = tr.layout.x * SLIDE_W_IN;
      const y = tr.layout.y * SLIDE_H_IN;
      const w = tr.layout.w * SLIDE_W_IN;
      const h = tr.layout.h * SLIDE_H_IN;
      const fontSize = Math.max(
        8,
        Math.min(40, Math.round(fontSizePtForRegion(tr.role, tr.layout.h) * 0.85)),
      );
      const align = alignForRole(tr.role);

      slide.addText(text, {
        x,
        y,
        w,
        h,
        fontSize,
        fontFace: "Arial",
        color: "2D2D2D",
        valign: "top",
        align: align === "center" ? "center" : align === "right" ? "right" : "left",
        margin: 3,
        wrap: true,
      });
    }
  }

  const safe = (deck.title || "presentation")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim()
    .slice(0, 80);
  await pptx.writeFile({ fileName: `${safe || "presentation"}.pptx` });
}
