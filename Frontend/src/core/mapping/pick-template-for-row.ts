import type { SlideContent } from "@/components/content-wizard/types";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import { companyTemplateToTemplate } from "../adapter/company-to-template";
import { normalizeStructuredContent } from "../normalizer/normalize-structured-content";
import { structuredContentCompactFromRows } from "../parser/structured-from-slide-rows";
import { mapContentToSlides } from "./map-content-to-slides";

/** Re-score layout choice for a single outline row (same logic as full-deck mapping). */
export function pickTemplateSlideIdForContentRow(
  row: SlideContent,
  company: CompanyTemplate,
): string {
  const structured = structuredContentCompactFromRows([row]);
  const normalized = normalizeStructuredContent(structured);
  const template = companyTemplateToTemplate(company);
  const models = mapContentToSlides(normalized, template, company.id);
  return (
    models[0]?.templateSlideId ?? company.slideTemplates[0]?.id ?? ""
  );
}
