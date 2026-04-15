import type { CompanyTemplate } from "./company-types";

/** Layout ids in the active pack exposed to Map / export restriction UI. */
export function companyAllowedTemplateSlideIds(
  company: CompanyTemplate,
): string[] {
  return company.slideTemplates.map((t) => t.id);
}
