import type { CompanyTemplate } from "@/components/template-system/company-types";
import type { SlideTemplateDefinition } from "@/components/template-system/types";
import type {
  CoreTemplateRegion,
  Template,
  TemplateRegionRole,
  TemplateSlide,
} from "../types";

function inferRoleForTextRegion(textRank: number): TemplateRegionRole {
  if (textRank === 0) return "title";
  return "body";
}

function slideDefinitionToTemplateSlide(def: SlideTemplateDefinition): TemplateSlide {
  const texts = def.regions
    .filter((r) => r.kind === "text")
    .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

  const regions: CoreTemplateRegion[] = def.regions.map((r) => {
    const layout = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (r.kind === "text") {
      const rank = texts.indexOf(r);
      const role = inferRoleForTextRegion(rank);
      return {
        id: r.id,
        role,
        maxChars: r.maxChars,
        layout,
      };
    }
    return {
      id: r.id,
      role: "image",
      maxChars: r.maxChars,
      layout,
    };
  });

  return {
    id: def.id,
    regions,
    slidePreviewDataUrl: def.slidePreviewDataUrl,
  };
}

export function companyTemplateToTemplate(company: CompanyTemplate): Template {
  return {
    id: company.id,
    slides: company.slideTemplates.map(slideDefinitionToTemplateSlide),
  };
}

export function findTemplateSlide(
  template: Template,
  templateSlideId: string,
): TemplateSlide | undefined {
  return template.slides.find((s) => s.id === templateSlideId);
}
