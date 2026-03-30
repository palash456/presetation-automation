import type { CompanyTemplate } from "./company-types";
import type { SlideTemplateDefinition } from "./types";

function newPackId() {
  return `co-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** One editable title + body layout to start drawing on the canvas. */
export function createBlankSlideDefinition(
  slideKey: string,
): SlideTemplateDefinition {
  return {
    id: `slide-${slideKey}`,
    name: "Slide 1",
    useCase: "Title",
    status: "needs_review",
    templateType: "Title slide",
    regions: [
      {
        id: `reg-${slideKey}-title`,
        label: "Title",
        kind: "text",
        x: 0.08,
        y: 0.1,
        w: 0.84,
        h: 0.16,
        maxChars: 120,
        textAlign: "start",
        overflow: "ellipsis",
      },
      {
        id: `reg-${slideKey}-body`,
        label: "Body",
        kind: "text",
        x: 0.08,
        y: 0.3,
        w: 0.84,
        h: 0.58,
        maxChars: 900,
        textAlign: "start",
        overflow: "clip",
      },
    ],
    layoutRule: "flexible",
    spacing: { padding: 40, margin: 48 },
    designTags: [],
    density: "medium",
    allowedElements: ["text", "image", "chart", "shape"],
    mappingPresetId: "title-hero",
  };
}

export function createBlankCompanyTemplate(
  name = "New template pack",
): CompanyTemplate {
  const key = Date.now().toString(36);
  return {
    id: newPackId(),
    name,
    shortDescription: "Blank pack — define regions on the canvas or import a deck.",
    industry: "General",
    style: "Minimal",
    presentationUseCases: ["Internal"],
    styleTags: ["Blank"],
    slideTemplates: [createBlankSlideDefinition(key)],
  };
}
