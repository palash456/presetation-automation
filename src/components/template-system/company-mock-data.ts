import type { TemplatePresetId } from "@/components/mapping/types";
import type { CompanyTemplate } from "./company-types";

/** Preset ids allowed in Map / export for this design system (from slide metadata). */
export function companyMappingPresetPool(
  company: CompanyTemplate,
): TemplatePresetId[] {
  const set = new Set<TemplatePresetId>();
  for (const t of company.slideTemplates) {
    if (t.mappingPresetId) set.add(t.mappingPresetId);
  }
  return [...set];
}
