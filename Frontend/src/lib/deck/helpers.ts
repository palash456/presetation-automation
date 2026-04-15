import type { EditorSlide, EditorTextElement } from "@/components/editor/types";
import type { SlideTemplateDefinition } from "@/components/template-system/types";
import {
  slideHasOverflow,
  type SlideContent,
} from "@/components/content-wizard/types";
import { buildTemplateSlideAlternatives } from "@/components/mapping/template-slide-alternatives";
import type { MappingSlide } from "@/components/mapping/types";
import type { PreviewSlide } from "@/components/preview-export/mock-deck";
import {
  companyAllowedTemplateSlideIds,
} from "@/components/template-system/company-mock-data";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import { companyTemplateToTemplate } from "@/core/adapter/company-to-template";
import { normalizeStructuredContent } from "@/core/normalizer/normalize-structured-content";
import { structuredContentCompactFromRows } from "@/core/parser/structured-from-slide-rows";
import {
  slideModelToEditorSlide,
  slideModelsToEditorSlides,
} from "@/core/layout/slide-model-to-editor-slide";
import { resolveSlideModelsForDeck } from "./slide-model-resolve";
import type { DeckDocument, DeckSlide, PreflightIssue } from "./types";
import {
  computeTemplateMatchScore,
  refreshDerivedSlideFields,
} from "./refresh-deck-slide";

export { computeTemplateMatchScore, refreshDerivedSlideFields };

export function newDeckId(): string {
  return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function slideFromMappingSeed(m: MappingSlide): DeckSlide {
  const base: SlideContent = {
    id: m.id,
    title: m.title,
    subtitle: m.subtitle,
    bullets: m.bullets,
    notes: "",
    mediaPlaceholders: ["Supporting visual"],
    templateMatchScore: m.matchScore,
    limits: {
      title: 72,
      subtitle: 140,
      bulletLine: 96,
      notes: 480,
    },
  };
  const merged: DeckSlide = {
    ...base,
    templateSlideId: m.templateSlideId,
    locked: m.locked,
    matchScore: m.matchScore,
    reasoning: m.reasoning,
    overflowRisk: m.overflowRisk,
    layoutBreakRisk: m.layoutBreakRisk,
    alternatives: m.alternatives,
  };
  return refreshDerivedSlideFields(merged);
}

/** One empty content slide so mapping/editor have real rows to work with. */
export function createStarterOutlineDeck(
  activeCompany: CompanyTemplate | null,
): DeckDocument {
  const allowedIds = activeCompany
    ? companyAllowedTemplateSlideIds(activeCompany)
    : [];
  const poolForDeck = allowedIds.length > 0 ? allowedIds : null;
  const firstLayoutId = activeCompany?.slideTemplates[0]?.id ?? "";
  const blank: SlideContent = {
    id: `slide-${Date.now().toString(36)}`,
    title: "",
    subtitle: "",
    bullets: [],
    notes: "",
    mediaPlaceholders: [],
    templateMatchScore: 70,
    limits: {
      title: 72,
      subtitle: 140,
      bulletLine: 96,
      notes: 480,
    },
  };
  const slides: DeckSlide[] = [
    refreshDerivedSlideFields({
      ...blank,
      templateSlideId: firstLayoutId,
      locked: false,
      matchScore: 70,
      reasoning:
        "Starter placeholder; mapping engine replaces in loadStarterOutline.",
      overflowRisk: false,
      layoutBreakRisk: false,
      alternatives: buildTemplateSlideAlternatives(
        activeCompany,
        firstLayoutId,
        poolForDeck,
      ),
    }),
  ];
  return {
    id: newDeckId(),
    title: "Untitled deck",
    updatedAt: Date.now(),
    checkpointVersion: 1,
    checkpointLabel: "Starter outline",
    entryMethod: "paste",
    pasteText: "",
    aiPrompt: "",
    uploadLabel: null,
    wizardStep: 2,
    activeCompanyTemplateId: activeCompany?.id ?? null,
    activeCompanyTemplateName: activeCompany?.name ?? null,
    allowedTemplateSlideIds: poolForDeck,
    slides,
    editorSlides: null,
    slideModels: null,
    structuredContent: normalizeStructuredContent(
      structuredContentCompactFromRows([blank]),
    ),
    layoutGeneration: 0,
  };
}

/** Stable id for SSR/client hydration match before persistent storage loads. */
const LOCAL_DRAFT_ID = "local-draft";

export function createBlankDeckDocument(): DeckDocument {
  return {
    id: LOCAL_DRAFT_ID,
    title: "Untitled deck",
    updatedAt: Date.now(),
    checkpointVersion: 1,
    checkpointLabel: undefined,
    entryMethod: "paste",
    pasteText: "",
    aiPrompt: "",
    uploadLabel: null,
    wizardStep: 1,
    activeCompanyTemplateId: null,
    activeCompanyTemplateName: null,
    allowedTemplateSlideIds: null,
    slides: [],
    editorSlides: null,
    slideModels: null,
    structuredContent: null,
    layoutGeneration: 0,
  };
}

const MAPPING_PATCH_KEYS = new Set<string>([
  "templateSlideId",
  "locked",
  "matchScore",
  "reasoning",
  "alternatives",
  "reasoningNote",
]);

export function isMappingOnlyPatch(patch: Partial<DeckSlide>): boolean {
  return Object.keys(patch).every((k) => MAPPING_PATCH_KEYS.has(k));
}

export function editorSlideToContentPatch(
  es: EditorSlide,
): Pick<DeckSlide, "title" | "subtitle" | "bullets"> {
  const texts = es.elements.filter(
    (e): e is EditorTextElement => e.type === "text",
  );
  const title = texts.find((e) => e.role === "Title")?.content ?? "";
  const subtitle = texts.find((e) => e.role === "Subtitle")?.content ?? "";
  const body = texts.find((e) => e.role === "Body")?.content ?? "";
  const bullets = body
    .split("\n")
    .map((l) => l.replace(/^\s*[•\-–—]\s*/, "").trim())
    .filter(Boolean);
  return { title, subtitle, bullets };
}

export function findCompanySlideDefinition(
  company: CompanyTemplate | null,
  templateSlideId: string,
): SlideTemplateDefinition | null {
  if (!company || !templateSlideId) return null;
  return (
    company.slideTemplates.find((t) => t.id === templateSlideId) ?? null
  );
}

/** SlideModel-driven canvas: requires an active pack and aligned models. */
export function buildEditorSlidesFromDeck(
  deck: DeckDocument,
  company: CompanyTemplate | null,
): EditorSlide[] {
  if (deck.slides.length === 0) return [];
  if (!company || company.slideTemplates.length === 0) {
    throw new Error("Template required");
  }
  const template = companyTemplateToTemplate(company);
  const models = resolveSlideModelsForDeck(deck, company);
  if (!models || models.length !== deck.slides.length) {
    throw new Error("Template required");
  }
  return slideModelsToEditorSlides(models, template);
}

/** Single slide for Map / Preview when the active pack resolves. */
export function buildEditorSlideForDeckIndex(
  deck: DeckDocument,
  slideIndex: number,
  company: CompanyTemplate | null,
): EditorSlide {
  if (!company || company.slideTemplates.length === 0) {
    throw new Error("Template required");
  }
  const slides = deck.slides;
  if (slideIndex < 0 || slideIndex >= slides.length) {
    throw new Error("Slide index out of range");
  }
  const template = companyTemplateToTemplate(company);
  const models = resolveSlideModelsForDeck(deck, company);
  if (!models || models.length !== slides.length || !models[slideIndex]) {
    throw new Error("Template required");
  }
  return slideModelToEditorSlide(models[slideIndex]!, template, slideIndex);
}

export function deckToPreviewSlides(slides: DeckSlide[]): PreviewSlide[] {
  return slides.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    bullets: s.bullets,
  }));
}

export function computePreflightIssues(deck: DeckDocument): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const { slides } = deck;

  slides.forEach((s, slideIndex) => {
    const label = s.title.trim() || `Slide ${slideIndex + 1}`;
    const ov = slideHasOverflow(s);
    if (ov.title) {
      issues.push({
        slideIndex,
        slideId: s.id,
        title: label,
        severity: "block",
        code: "overflow_title",
        message: `Title exceeds ${s.limits.title} characters.`,
      });
    }
    if (ov.subtitle) {
      issues.push({
        slideIndex,
        slideId: s.id,
        title: label,
        severity: "warn",
        code: "overflow_subtitle",
        message: `Subtitle exceeds ${s.limits.subtitle} characters.`,
      });
    }
    if (ov.bullets) {
      issues.push({
        slideIndex,
        slideId: s.id,
        title: label,
        severity: "block",
        code: "overflow_bullets",
        message: `Bullets exceed line length (${s.limits.bulletLine}) or total budget (${s.limits.bulletLine * 12} chars).`,
      });
    }
    if (ov.notes) {
      issues.push({
        slideIndex,
        slideId: s.id,
        title: label,
        severity: "warn",
        code: "overflow_notes",
        message: `Speaker notes exceed ${s.limits.notes} characters.`,
      });
    }
    if (s.layoutBreakRisk) {
      issues.push({
        slideIndex,
        slideId: s.id,
        title: label,
        severity: "warn",
        code: "layout_break",
        message: "Dense bullets or title layout may break the chosen template rails.",
      });
    }
    if (s.matchScore < 62) {
      issues.push({
        slideIndex,
        slideId: s.id,
        title: label,
        severity: "warn",
        code: "low_match",
        message: `Template match is low (${s.matchScore}%). Consider another layout.`,
      });
    }
  });

  if (
    deck.editorSlides &&
    deck.editorSlides.length !== deck.slides.length
  ) {
    issues.push({
      slideIndex: -1,
      slideId: "",
      title: "Editor",
      severity: "warn",
      code: "editor_stale",
      message: "Canvas slide count does not match outline — reopen editor to rebuild from outline.",
    });
  }

  return issues;
}

/** Export fidelity copy for UI surfaces. */
export const EXPORT_FIDELITY = {
  summary:
    "Text and box layout align closely to the template. Chart imagery may simplify; animation timing is approximate in PDF.",
} as const;
