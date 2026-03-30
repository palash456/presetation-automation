export type TemplateAlternative = {
  /** Company pack `SlideTemplateDefinition.id` */
  id: string;
  name: string;
  matchScore: number;
  reasoning: string;
};

export type MappingSlide = {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  templateSlideId: string;
  locked: boolean;
  matchScore: number;
  reasoning: string;
  overflowRisk: boolean;
  layoutBreakRisk: boolean;
  alternatives: TemplateAlternative[];
};
