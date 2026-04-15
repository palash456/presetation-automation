import type { SlideTemplateDefinition } from "./types";

export type CompanyIndustry =
  | "Technology"
  | "General"
  | "Consulting"
  | "Healthcare"
  | "Finance";

export type CompanyStyle = "Corporate" | "Creative" | "Minimal";

export type PresentationUseCase = "Pitch" | "Report" | "Internal";

export type CompanyTemplate = {
  id: string;
  name: string;
  shortDescription: string;
  industry: CompanyIndustry;
  style: CompanyStyle;
  presentationUseCases: PresentationUseCase[];
  styleTags: string[];
  slideTemplates: SlideTemplateDefinition[];
};
