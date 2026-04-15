import type { EditorSlide } from "@/components/editor/types";
import type { EntryMethod, SlideContent } from "@/components/content-wizard/types";
import type { TemplateAlternative } from "@/components/mapping/types";
import type { SlideModel, StructuredContent } from "@/core/types";

/** One slide: structured content + template assignment (single source of truth). */
export type DeckSlide = SlideContent & {
  /** Selected layout row from the active company pack (`SlideTemplateDefinition.id`). */
  templateSlideId: string;
  locked: boolean;
  matchScore: number;
  reasoning: string;
  /** Your note, persisted separately from model-generated reasoning. */
  reasoningNote?: string;
  overflowRisk: boolean;
  layoutBreakRisk: boolean;
  alternatives: TemplateAlternative[];
};

export type DeckDocument = {
  id: string;
  title: string;
  updatedAt: number;
  checkpointVersion: number;
  checkpointLabel?: string;
  entryMethod: EntryMethod;
  pasteText: string;
  aiPrompt: string;
  uploadLabel: string | null;
  wizardStep: 1 | 2;
  /** Active design system (company / theme package). Null = no package selected yet. */
  activeCompanyTemplateId: string | null;
  activeCompanyTemplateName: string | null;
  /**
   * When set, mapping UI limits picks to these pack layout ids.
   * Null = all slides in the active pack are allowed.
   */
  allowedTemplateSlideIds: string[] | null;
  slides: DeckSlide[];
  /** Canvas layout; null = regenerate from `slides` on next editor visit. */
  editorSlides: EditorSlide[] | null;
  /** Template-first mapping output (aligned with `slides` when set). */
  slideModels: SlideModel[] | null;
  /**
   * Canonical outline structure (sections + blocks). Preferred source for
   * remap; deck rows remain a denormalized view for legacy UI paths.
   */
  structuredContent: StructuredContent | null;
  /** Bumps when outline changes require rebuilding the canvas. */
  layoutGeneration: number;
};

export type PreflightIssue = {
  slideIndex: number;
  slideId: string;
  title: string;
  severity: "block" | "warn";
  code: string;
  message: string;
};
