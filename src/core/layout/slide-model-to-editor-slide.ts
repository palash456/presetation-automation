import type {
  EditorElement,
  EditorSlide,
  EditorTextElement,
  PlaceholderKind,
} from "@/components/editor/types";
import type { SlideModel, Template, TemplateRegionRole } from "../types";
import { findTemplateSlide } from "../adapter/company-to-template";

const sans = "var(--font-geist-sans), system-ui, sans-serif";

function roleToPlaceholderKind(_role: TemplateRegionRole): PlaceholderKind {
  return "image";
}

function editorTextRole(tr: { role: TemplateRegionRole }): string {
  if (tr.role === "title") return "Title";
  if (tr.role === "footer") return "Subtitle";
  return "Body";
}

function fontSizeForRegion(role: TemplateRegionRole, hNorm: number): number {
  const h = Math.max(0.02, hNorm);
  if (role === "title") return Math.min(44, Math.max(18, Math.round(10 + h * 85)));
  if (role === "footer") return Math.min(14, Math.max(10, Math.round(6 + h * 40)));
  return Math.min(22, Math.max(11, Math.round(7 + h * 55)));
}

function alignForRole(role: TemplateRegionRole): "left" | "center" | "right" {
  return "left";
}

export function slideModelToEditorSlide(
  model: SlideModel,
  template: Template,
  slideIndex: number,
): EditorSlide {
  const ts = findTemplateSlide(template, model.templateSlideId);
  if (!ts) {
    return emptyEditorSlide(slideIndex);
  }

  const id = `es-slide-${slideIndex}`;
  const elements: EditorElement[] = [];

  for (const tr of ts.regions) {
    const payload = model.regions.find((r) => r.regionId === tr.id);
    const raw = payload?.content ?? "";
    const textContent = Array.isArray(raw) ? raw.join("\n") : String(raw);

    if (tr.role === "image") {
      elements.push({
        type: "placeholder",
        id: `${id}-ph-${tr.id}`,
        role: tr.id,
        placeholderKind: roleToPlaceholderKind(tr.role),
        label: "Image",
        x: tr.layout.x * 100,
        y: tr.layout.y * 100,
        w: tr.layout.w * 100,
        h: tr.layout.h * 100,
        locked: true,
      });
      continue;
    }

    const te: EditorTextElement = {
      type: "text",
      id: `${id}-txt-${tr.id}`,
      role: editorTextRole(tr),
      content: textContent,
      x: tr.layout.x * 100,
      y: tr.layout.y * 100,
      w: tr.layout.w * 100,
      h: tr.layout.h * 100,
      locked: tr.role === "title",
      fontFamily: sans,
      fontSize: fontSizeForRegion(tr.role, tr.layout.h),
      lineHeight: tr.role === "title" ? 1.12 : 1.35,
      align: alignForRole(tr.role),
    };
    elements.push(te);
  }

  return {
    id,
    padding: 32,
    spacing: 16,
    align: "left",
    elements,
    ...(ts.slidePreviewDataUrl
      ? { backgroundImageUrl: ts.slidePreviewDataUrl }
      : {}),
  };
}

function emptyEditorSlide(i: number): EditorSlide {
  return {
    id: `es-empty-${i}`,
    padding: 48,
    spacing: 16,
    align: "left",
    elements: [],
  };
}

export function slideModelsToEditorSlides(
  models: SlideModel[],
  template: Template,
): EditorSlide[] {
  return models.map((m, i) => slideModelToEditorSlide(m, template, i));
}
