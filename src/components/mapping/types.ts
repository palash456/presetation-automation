export type TemplatePresetId =
  | "title-hero"
  | "content-classic"
  | "comparison-split"
  | "data-focus"
  | "section-minimal";

export type TemplateAlternative = {
  id: TemplatePresetId;
  name: string;
  matchScore: number;
  reasoning: string;
};

export type MappingSlide = {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  assignedTemplateId: TemplatePresetId;
  locked: boolean;
  matchScore: number;
  reasoning: string;
  overflowRisk: boolean;
  layoutBreakRisk: boolean;
  alternatives: TemplateAlternative[];
};
