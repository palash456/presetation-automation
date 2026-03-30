import { buildTemplateSlideAlternatives } from "@/components/mapping/template-slide-alternatives";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import { companyTemplateToTemplate } from "@/core/adapter/company-to-template";
import { mapContentToSlides } from "@/core/mapping/map-content-to-slides";
import { normalizeStructuredContent } from "@/core/normalizer/normalize-structured-content";
import { structuredFromPlainText } from "@/core/parser/structured-from-plain-text";
import { structuredContentCompactFromRows } from "@/core/parser/structured-from-slide-rows";
import { structuredContentFromDeckSlides } from "@/core/parser/structured-from-deck-slides";
import type { SlideModel, StructuredContent, Template } from "@/core/types";
import type { DeckSlide } from "./types";
import { refreshDerivedSlideFields } from "./refresh-deck-slide";

const DEFAULT_LIMITS = {
  title: 72,
  subtitle: 140,
  bulletLine: 96,
  notes: 480,
} as const;

export type SlideBuildResult = {
  models: SlideModel[];
  template: Template;
  slides: DeckSlide[];
  /** Normalized structured outline used for this build (persist on deck). */
  structured: StructuredContent;
};

function modelToDeckSlide(
  model: SlideModel,
  template: Template,
  company: CompanyTemplate,
  index: number,
  existingId?: string,
): DeckSlide {
  const ts = template.slides.find((s) => s.id === model.templateSlideId);
  let title = `Slide ${index + 1}`;
  let subtitle = "";
  const bodyLines: string[] = [];

  if (ts) {
    for (const tr of ts.regions) {
      const payload = model.regions.find((r) => r.regionId === tr.id);
      if (!payload) continue;
      const val = payload.content;
      const str = Array.isArray(val) ? val.join("\n") : String(val);
      if (tr.role === "title" && str.trim()) title = str.trim();
      else if (tr.role === "body" && str.trim()) {
        bodyLines.push(
          ...str
            .split("\n")
            .map((l) => l.replace(/^\s*[•\-–—]\s*/, "").trim())
            .filter(Boolean),
        );
      } else if (tr.role === "footer" && str.trim()) {
        subtitle = str.trim();
      }
    }
  }

  const base = {
    id:
      existingId?.trim() ||
      `deck-${index}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    title,
    subtitle,
    bullets: bodyLines,
    notes: "",
    mediaPlaceholders: [] as string[],
    templateMatchScore: 82,
    limits: { ...DEFAULT_LIMITS },
  };

  return refreshDerivedSlideFields({
    ...base,
    templateSlideId: model.templateSlideId,
    locked: false,
    matchScore: 82,
    reasoning: "Mapped with template-first engine (layout id from pickBestTemplateSlide).",
    overflowRisk:
      title.length > DEFAULT_LIMITS.title ||
      subtitle.length > DEFAULT_LIMITS.subtitle ||
      bodyLines.some((l) => l.length > DEFAULT_LIMITS.bulletLine),
    layoutBreakRisk: bodyLines.length > 6,
    alternatives: buildTemplateSlideAlternatives(
      company,
      model.templateSlideId,
      null,
    ),
  });
}

/** Plain text paste / AI intro → structured (avoids double-expansion from pre-split rows). */
export function buildSlideModelsFromPlainText(
  plainText: string,
  company: CompanyTemplate,
): SlideBuildResult {
  const structured = structuredFromPlainText(plainText);
  return buildSlideModelsFromStructured(structured, company);
}

/** Wizard `SlideContent[]` (after paste / AI using `slidesFromPlainText`). */
export function buildSlideModelsFromContentRows(
  rows: import("@/components/content-wizard/types").SlideContent[],
  company: CompanyTemplate,
): SlideBuildResult {
  const structured = structuredContentCompactFromRows(rows);
  return buildSlideModelsFromStructured(structured, company);
}

export function buildSlideModelsFromStructured(
  structured: StructuredContent,
  company: CompanyTemplate,
): SlideBuildResult {
  const normalized = normalizeStructuredContent(structured);
  const template = companyTemplateToTemplate(company);
  const models = mapContentToSlides(normalized, template, company.id);
  const slides = models.map((m, i) =>
    modelToDeckSlide(m, template, company, i),
  );
  return { models, template, slides, structured: normalized };
}

/**
 * Rebuild from persisted structured outline when section count matches rows;
 * otherwise derive from flat slides (transitional).
 */
export function rebuildSlideModelsFromDeckSlides(
  existingSlides: DeckSlide[],
  company: CompanyTemplate,
  structuredHint?: StructuredContent | null,
): SlideBuildResult {
  const useHint =
    structuredHint != null &&
    structuredHint.sections.length === existingSlides.length;
  const baseStructured = useHint
    ? structuredHint
    : structuredContentFromDeckSlides(existingSlides);
  const normalized = normalizeStructuredContent(baseStructured);
  const template = companyTemplateToTemplate(company);
  const models = mapContentToSlides(normalized, template, company.id);
  const slides = models.map((m, i) =>
    modelToDeckSlide(m, template, company, i, existingSlides[i]?.id),
  );
  return { models, template, slides, structured: normalized };
}
