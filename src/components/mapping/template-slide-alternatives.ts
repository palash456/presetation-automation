import type { CompanyTemplate } from "@/components/template-system/company-types";
import type { TemplateAlternative } from "./types";
import { reasoningAt, scoreFromSalt } from "./mock-slides";

/** Other layouts in the active pack. */
export function buildTemplateSlideAlternatives(
  company: CompanyTemplate | null,
  currentTemplateSlideId: string,
  allowedTemplateSlideIds: string[] | null,
): TemplateAlternative[] {
  if (!company?.slideTemplates.length) return [];
  let defs = company.slideTemplates;
  if (allowedTemplateSlideIds?.length) {
    const allow = new Set(allowedTemplateSlideIds);
    defs = defs.filter((d) => allow.has(d.id));
  }
  return defs
    .filter((d) => d.id !== currentTemplateSlideId)
    .slice(0, 6)
    .map((d, i) => ({
      id: d.id,
      name: d.name,
      matchScore: scoreFromSalt(88 - i * 4, `${currentTemplateSlideId}:${d.id}`),
      reasoning: reasoningAt(i),
    }));
}

export function remapTemplateSlideAlternatives(
  company: CompanyTemplate | null,
  currentTemplateSlideId: string,
  allowed: string[] | null,
): TemplateAlternative[] {
  return buildTemplateSlideAlternatives(
    company,
    currentTemplateSlideId,
    allowed,
  );
}
