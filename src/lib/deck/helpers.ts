import type {
  EditorElement,
  EditorSlide,
  EditorTextElement,
  PlaceholderKind,
  TextAlign,
} from "@/components/editor/types";
import type {
  SlideTemplateDefinition,
  TemplateRegion,
} from "@/components/template-system/types";
import {
  slideHasOverflow,
  type SlideContent,
  type SlideType,
} from "@/components/content-wizard/types";
import {
  ALL_TEMPLATE_IDS,
  defaultAlternatives,
} from "@/components/mapping/template-catalog";
import type { MappingSlide, TemplatePresetId } from "@/components/mapping/types";
import type { PreviewSlide } from "@/components/preview-export/mock-deck";
import { companyMappingPresetPool } from "@/components/template-system/company-mock-data";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import { companyTemplateToTemplate } from "@/core/adapter/company-to-template";
import { slideModelToEditorSlide } from "@/core/layout/slide-model-to-editor-slide";
import { resolveSlideModelsForDeck } from "./slide-model-resolve";
import type { DeckDocument, DeckSlide, PreflightIssue } from "./types";
import {
  computeTemplateMatchScore,
  refreshDerivedSlideFields,
} from "./refresh-deck-slide";

export { computeTemplateMatchScore, refreshDerivedSlideFields };

const sans = "var(--font-geist-sans), system-ui, sans-serif";

export function newDeckId(): string {
  return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function slideTypeToTemplate(st: SlideType): TemplatePresetId {
  const m: Record<SlideType, TemplatePresetId> = {
    title: "title-hero",
    content: "content-classic",
    comparison: "comparison-split",
    data: "data-focus",
    section: "section-minimal",
    closing: "section-minimal",
  };
  return m[st];
}

function templateToSlideType(id: TemplatePresetId): SlideType {
  const m: Record<TemplatePresetId, SlideType> = {
    "title-hero": "title",
    "content-classic": "content",
    "comparison-split": "comparison",
    "data-focus": "data",
    "section-minimal": "section",
  };
  return m[id];
}

/** When the ideal preset is not in the active design system, try these first. */
const PRESET_FALLBACK_BY_SLIDE_TYPE: Record<SlideType, TemplatePresetId[]> = {
  title: [
    "title-hero",
    "section-minimal",
    "content-classic",
    "data-focus",
    "comparison-split",
  ],
  content: [
    "content-classic",
    "data-focus",
    "comparison-split",
    "section-minimal",
    "title-hero",
  ],
  comparison: [
    "comparison-split",
    "content-classic",
    "data-focus",
    "section-minimal",
    "title-hero",
  ],
  data: [
    "data-focus",
    "content-classic",
    "comparison-split",
    "section-minimal",
    "title-hero",
  ],
  section: [
    "section-minimal",
    "title-hero",
    "content-classic",
    "data-focus",
    "comparison-split",
  ],
  closing: [
    "section-minimal",
    "title-hero",
    "content-classic",
    "data-focus",
    "comparison-split",
  ],
};

/**
 * Resolve a mapping preset when an active company package restricts the catalog.
 */
export function resolvePresetWithPreference(
  preferred: TemplatePresetId,
  pool: TemplatePresetId[] | null | undefined,
): { id: TemplatePresetId; usedFallback: boolean } {
  if (!pool || pool.length === 0) {
    return { id: preferred, usedFallback: false };
  }
  if (pool.includes(preferred)) {
    return { id: preferred, usedFallback: false };
  }
  const slideType = templateToSlideType(preferred);
  const ranked = PRESET_FALLBACK_BY_SLIDE_TYPE[slideType];
  for (const id of ranked) {
    if (pool.includes(id)) {
      return { id, usedFallback: true };
    }
  }
  const firstInPool = ALL_TEMPLATE_IDS.find((id) => pool.includes(id));
  return {
    id: firstInPool ?? preferred,
    usedFallback: true,
  };
}

export function slideFromMappingSeed(m: MappingSlide): DeckSlide {
  const slideType = templateToSlideType(m.assignedTemplateId);
  const base: SlideContent = {
    id: m.id,
    title: m.title,
    subtitle: m.subtitle,
    bullets: m.bullets,
    notes: "",
    mediaPlaceholders:
      slideType === "title"
        ? ["Hero image"]
        : slideType === "data"
          ? ["Chart or table"]
          : slideType === "comparison"
            ? ["Left visual", "Right visual"]
            : slideType === "content"
              ? ["Supporting visual"]
              : [],
    slideType,
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
    assignedTemplateId: m.assignedTemplateId,
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
  const pool = activeCompany
    ? companyMappingPresetPool(activeCompany)
    : null;
  const blank: SlideContent = {
    id: `slide-${Date.now().toString(36)}`,
    title: "",
    subtitle: "",
    bullets: [],
    notes: "",
    mediaPlaceholders: [],
    slideType: "content",
    templateMatchScore: 70,
    limits: {
      title: 72,
      subtitle: 140,
      bulletLine: 96,
      notes: 480,
    },
  };
  const slides = contentRowsToDeckSlides([blank], pool);
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
    allowedMappingPresetIds:
      pool && pool.length > 0 ? pool : null,
    slides,
    editorSlides: null,
    slideModels: null,
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
    allowedMappingPresetIds: null,
    slides: [],
    editorSlides: null,
    slideModels: null,
    layoutGeneration: 0,
  };
}

export function contentRowsToDeckSlides(
  rows: SlideContent[],
  mappingPool: TemplatePresetId[] | null = null,
): DeckSlide[] {
  return rows.map((c) => {
    const ideal = slideTypeToTemplate(c.slideType);
    const { id: tid, usedFallback } = resolvePresetWithPreference(
      ideal,
      mappingPool,
    );
    const ov = slideHasOverflow(c);
    const s: DeckSlide = {
      ...c,
      assignedTemplateId: tid,
      locked: false,
      matchScore: c.templateMatchScore,
      reasoning: usedFallback
        ? "No matching template in this design system — using closest alternative."
        : "Assigned from slide type. Adjust template in mapping if needed.",
      overflowRisk: ov.title || ov.subtitle || ov.bullets || ov.notes,
      layoutBreakRisk: c.bullets.length > 6,
      alternatives: defaultAlternatives(tid, undefined, mappingPool),
    };
    return refreshDerivedSlideFields(s);
  });
}

/** Re-assign mapping presets when the active design system (preset pool) changes. */
export function remapDeckSlidesToPool(
  slides: DeckSlide[],
  pool: TemplatePresetId[] | null,
): DeckSlide[] {
  return slides.map((s) => {
    const { id: tid, usedFallback } = resolvePresetWithPreference(
      s.assignedTemplateId,
      pool,
    );
    return refreshDerivedSlideFields({
      ...s,
      assignedTemplateId: tid,
      reasoning: usedFallback
        ? "No matching template in this design system — using closest alternative."
        : s.reasoning,
      alternatives: defaultAlternatives(tid, undefined, pool),
    });
  });
}

/** When outline slide type changes, keep mapping preset aligned with the active design system. */
export function deckSlidePatchForSlideType(
  base: DeckSlide,
  slideType: SlideType,
  pool: TemplatePresetId[] | null,
): Partial<DeckSlide> {
  const ideal = slideTypeToTemplate(slideType);
  const { id: tid, usedFallback } = resolvePresetWithPreference(ideal, pool);
  return {
    slideType,
    assignedTemplateId: tid,
    reasoning: usedFallback
      ? "No matching template in this design system — using closest alternative."
      : base.reasoning,
    alternatives: defaultAlternatives(tid, undefined, pool),
  };
}

const MAPPING_PATCH_KEYS = new Set<string>([
  "assignedTemplateId",
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

function countPriorSamePreset(
  slides: DeckSlide[],
  slideIndex: number,
  preset: TemplatePresetId,
): number {
  let n = 0;
  for (let i = 0; i < slideIndex; i++) {
    if (slides[i]!.assignedTemplateId === preset) n++;
  }
  return n;
}

/**
 * Resolve which template layout row applies to this deck slide (metadata-driven).
 */
export function resolveSlideDefinitionForDeckSlide(
  slides: DeckSlide[],
  slideIndex: number,
  company: CompanyTemplate | null,
): SlideTemplateDefinition | null {
  const defs = company?.slideTemplates;
  if (!defs?.length) return null;

  const ds = slides[slideIndex]!;
  const nDeck = slides.length;
  const nDef = defs.length;

  if (nDef === nDeck && defs[slideIndex]) {
    return defs[slideIndex]!;
  }

  const preset = ds.assignedTemplateId;
  const matches = defs.filter((t) => t.mappingPresetId === preset);
  if (matches.length > 0) {
    const variant = countPriorSamePreset(slides, slideIndex, preset);
    return matches[variant % matches.length]!;
  }

  return defs[slideIndex % defs.length]!;
}

function sortTextRegions(regions: TemplateRegion[]): TemplateRegion[] {
  return regions
    .filter((r) => r.kind === "text")
    .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
}

function textRankByRegionId(regions: TemplateRegion[]): Map<string, number> {
  const sorted = sortTextRegions(regions);
  return new Map(sorted.map((r, i) => [r.id, i]));
}

function regionKindToPlaceholder(k: TemplateRegion["kind"]): PlaceholderKind {
  if (k === "chart") return "chart";
  if (k === "shape") return "shape";
  if (k === "icon") return "icon";
  return "image";
}

function regionToTextAlign(r: TemplateRegion): TextAlign {
  if (r.textAlign === "center") return "center";
  if (r.textAlign === "end") return "right";
  return "left";
}

function fontSizeForTextSlot(ti: number, hNorm: number): number {
  const h = Math.max(0.02, hNorm);
  if (ti === 0) return Math.min(44, Math.max(18, Math.round(10 + h * 85)));
  if (ti === 1) return Math.min(28, Math.max(13, Math.round(8 + h * 70)));
  return Math.min(22, Math.max(11, Math.round(7 + h * 55)));
}

function lineHeightForTextSlot(ti: number): number {
  if (ti === 0) return 1.12;
  if (ti === 1) return 1.3;
  return 1.42;
}

function truncateToMaxChars(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function buildGenericEditorSlide(ds: DeckSlide, index: number): EditorSlide {
  const id = `es-${ds.id}`;
  const bulletText = ds.bullets.map((b) => `• ${b}`).join("\n");
  const elements: EditorElement[] = [
    {
      type: "text",
      id: `${id}-t`,
      role: "Title",
      content: ds.title || `Slide ${index + 1}`,
      x: 8,
      y: 12,
      w: 72,
      h: 14,
      locked: true,
      fontFamily: sans,
      fontSize: 36,
      lineHeight: 1.15,
      align: "left",
    },
    {
      type: "text",
      id: `${id}-s`,
      role: "Subtitle",
      content: ds.subtitle,
      x: 8,
      y: 28,
      w: 64,
      h: 10,
      locked: false,
      fontFamily: sans,
      fontSize: 18,
      lineHeight: 1.4,
      align: "left",
    },
    {
      type: "text",
      id: `${id}-b`,
      role: "Body",
      content:
        bulletText ||
        (ds.notes ? ds.notes.slice(0, 400) : "—"),
      x: 8,
      y: 42,
      w: 52,
      h: 38,
      locked: false,
      fontFamily: sans,
      fontSize: 15,
      lineHeight: 1.45,
      align: "left",
    },
    {
      type: "placeholder",
      id: `${id}-img`,
      role: "Hero image",
      placeholderKind: "image",
      label: "Image",
      x: 64,
      y: 18,
      w: 30,
      h: 62,
      locked: true,
    },
  ];
  return {
    id,
    padding: 48,
    spacing: 16,
    align: "left",
    elements,
  };
}

export function buildEditorSlideFromCompanyDefinition(
  ds: DeckSlide,
  def: SlideTemplateDefinition,
  index: number,
): EditorSlide {
  const id = `es-${ds.id}`;
  const bulletText = ds.bullets.map((b) => `• ${b}`).join("\n");
  const titleContent = truncateToMaxChars(
    ds.title || `Slide ${index + 1}`,
    def.regions.find((r) => r.kind === "text")?.maxChars ?? 600,
  );
  const subtitleContent = truncateToMaxChars(
    ds.subtitle,
    400,
  );
  const bodyContent = truncateToMaxChars(
    bulletText || (ds.notes ? ds.notes.slice(0, 400) : "—"),
    4000,
  );

  const rankMap = textRankByRegionId(def.regions);
  const elements: EditorElement[] = [];

  for (const region of def.regions) {
    if (region.kind === "text") {
      const ti = rankMap.get(region.id) ?? 0;
      let raw =
        ti === 0
          ? titleContent
          : ti === 1
            ? subtitleContent
            : ti === 2
              ? bodyContent
              : "";
      raw = truncateToMaxChars(raw, region.maxChars || 2000);
      const role =
        ti === 0
          ? "Title"
          : ti === 1
            ? "Subtitle"
            : ti === 2
              ? "Body"
              : region.label || `Text ${ti + 1}`;
      const locked = region.locked ?? ti === 0;
      elements.push({
        type: "text",
        id: `${id}-txt-${region.id}`,
        role,
        content: raw,
        x: region.x * 100,
        y: region.y * 100,
        w: region.w * 100,
        h: region.h * 100,
        locked,
        fontFamily: sans,
        fontSize: fontSizeForTextSlot(ti, region.h),
        lineHeight: lineHeightForTextSlot(ti),
        align: regionToTextAlign(region),
      });
    } else {
      elements.push({
        type: "placeholder",
        id: `${id}-ph-${region.id}`,
        role: region.label,
        placeholderKind: regionKindToPlaceholder(region.kind),
        label: region.label,
        x: region.x * 100,
        y: region.y * 100,
        w: region.w * 100,
        h: region.h * 100,
        locked: region.locked ?? true,
      });
    }
  }

  if (elements.length === 0) {
    return buildGenericEditorSlide(ds, index);
  }

  const pad = Math.min(56, Math.max(24, def.spacing.padding));
  return {
    id,
    padding: pad,
    spacing: def.spacing.margin,
    align: "left",
    elements,
    ...(def.slidePreviewDataUrl
      ? { backgroundImageUrl: def.slidePreviewDataUrl }
      : {}),
  };
}

/** Single slide for Map / Preview / export when company metadata exists. */
export function buildEditorSlideForDeckIndex(
  deck: DeckDocument,
  slideIndex: number,
  company: CompanyTemplate | null,
): EditorSlide {
  const slides = deck.slides;
  const ds = slides[slideIndex]!;
  const models = resolveSlideModelsForDeck(deck, company);
  if (
    company &&
    company.slideTemplates.length > 0 &&
    models &&
    models.length === slides.length &&
    models[slideIndex]
  ) {
    const template = companyTemplateToTemplate(company);
    return slideModelToEditorSlide(models[slideIndex]!, template, slideIndex);
  }
  const def = resolveSlideDefinitionForDeckSlide(slides, slideIndex, company);
  if (def) {
    return buildEditorSlideFromCompanyDefinition(ds, def, slideIndex);
  }
  return buildGenericEditorSlide(ds, slideIndex);
}

/** Build editor canvas slides from outline + optional company template (metadata). */
export function buildEditorSlidesFromDeck(
  slides: DeckSlide[],
  company: CompanyTemplate | null = null,
): EditorSlide[] {
  return slides.map((ds, index) => {
    const def = resolveSlideDefinitionForDeckSlide(slides, index, company);
    if (def) {
      return buildEditorSlideFromCompanyDefinition(ds, def, index);
    }
    return buildGenericEditorSlide(ds, index);
  });
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
