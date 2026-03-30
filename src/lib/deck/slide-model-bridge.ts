import type { SlideType } from "@/components/content-wizard/types";
import type { TemplatePresetId } from "@/components/mapping/types";
import { defaultAlternatives } from "@/components/mapping/template-catalog";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import { companyTemplateToTemplate } from "@/core/adapter/company-to-template";
import { normalizeStructuredContent } from "@/core/normalizer/normalize-structured-content";
import { structuredFromPlainText } from "@/core/parser/structured-from-plain-text";
import { structuredContentCompactFromRows } from "@/core/parser/structured-from-slide-rows";
import { structuredContentFromDeckSlides } from "@/core/parser/structured-from-deck-slides";
import { mapContentToSlides } from "@/core/mapping/map-content-to-slides";
import type { SlideModel, StructuredContent, Template } from "@/core/types";
import type { DeckSlide } from "./types";
import { refreshDerivedSlideFields } from "./refresh-deck-slide";

function presetToSlideType(id: TemplatePresetId): SlideType {
  const m: Record<TemplatePresetId, SlideType> = {
    "title-hero": "title",
    "content-classic": "content",
    "comparison-split": "comparison",
    "data-focus": "data",
    "section-minimal": "section",
  };
  return m[id] ?? "content";
}

const DEFAULT_LIMITS = {
  title: 72,
  subtitle: 140,
  bulletLine: 96,
  notes: 480,
} as const;

function modelToDeckSlide(
  model: SlideModel,
  template: Template,
  index: number,
  pool: TemplatePresetId[] | null,
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

  const assigned: TemplatePresetId =
    ts?.mappingPresetId && (!pool || pool.length === 0 || pool.includes(ts.mappingPresetId))
      ? ts.mappingPresetId
      : pool?.[0] ?? ts?.mappingPresetId ?? "content-classic";

  const base = {
    id:
      existingId?.trim() ||
      `deck-${index}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    title,
    subtitle,
    bullets: bodyLines,
    notes: "",
    mediaPlaceholders: [] as string[],
    slideType: presetToSlideType(assigned),
    templateMatchScore: 82,
    limits: { ...DEFAULT_LIMITS },
  };

  return refreshDerivedSlideFields({
    ...base,
    assignedTemplateId: assigned,
    locked: false,
    matchScore: 82,
    reasoning: "Mapped with template-first engine.",
    overflowRisk:
      title.length > DEFAULT_LIMITS.title ||
      subtitle.length > DEFAULT_LIMITS.subtitle ||
      bodyLines.some((l) => l.length > DEFAULT_LIMITS.bulletLine),
    layoutBreakRisk: bodyLines.length > 6,
    alternatives: defaultAlternatives(assigned, undefined, pool),
  });
}

function mappingPoolFromCompany(company: CompanyTemplate): TemplatePresetId[] | null {
  const pool = company.slideTemplates
    .map((s) => s.mappingPresetId)
    .filter((x): x is TemplatePresetId => Boolean(x));
  return pool.length > 0 ? [...new Set(pool)] : null;
}

/** Plain text paste / AI intro → structured (avoids double-expansion from pre-split rows). */
export function buildSlideModelsFromPlainText(
  plainText: string,
  company: CompanyTemplate,
): { models: SlideModel[]; template: Template; slides: DeckSlide[] } {
  const structured = structuredFromPlainText(plainText);
  return buildSlideModelsFromStructured(structured, company);
}

/** Wizard `SlideContent[]` (after paste / AI using `slidesFromPlainText`). */
export function buildSlideModelsFromContentRows(
  rows: import("@/components/content-wizard/types").SlideContent[],
  company: CompanyTemplate,
): { models: SlideModel[]; template: Template; slides: DeckSlide[] } {
  const structured = structuredContentCompactFromRows(rows);
  return buildSlideModelsFromStructured(structured, company);
}

export function buildSlideModelsFromStructured(
  structured: StructuredContent,
  company: CompanyTemplate,
): { models: SlideModel[]; template: Template; slides: DeckSlide[] } {
  const normalized = normalizeStructuredContent(structured);
  const template = companyTemplateToTemplate(company);
  const models = mapContentToSlides(normalized, template, company.id);
  const uniq = mappingPoolFromCompany(company);
  const slides = models.map((m, i) => modelToDeckSlide(m, template, i, uniq));
  return { models, template, slides };
}

/** Rebuild models from existing deck slides (e.g. after template switch). */
export function rebuildSlideModelsFromDeckSlides(
  existingSlides: DeckSlide[],
  company: CompanyTemplate,
): { models: SlideModel[]; template: Template; slides: DeckSlide[] } {
  const structured = structuredContentFromDeckSlides(existingSlides);
  const normalized = normalizeStructuredContent(structured);
  const template = companyTemplateToTemplate(company);
  const models = mapContentToSlides(normalized, template, company.id);
  const uniq = mappingPoolFromCompany(company);
  const slides = models.map((m, i) =>
    modelToDeckSlide(m, template, i, uniq, existingSlides[i]?.id),
  );
  return { models, template, slides };
}
