import type { CompanyTemplate } from "./company-types";

export function cloneCompanyTemplate(co: CompanyTemplate): CompanyTemplate {
  return {
    ...co,
    slideTemplates: co.slideTemplates.map((t) => ({
      ...t,
      regions: t.regions.map((r) => ({ ...r })),
      designTags: [...t.designTags],
      allowedElements: [...t.allowedElements],
    })),
    styleTags: [...co.styleTags],
    presentationUseCases: [...co.presentationUseCases],
  };
}
