import type { TemplatePresetId } from "@/components/mapping/types";

export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "image"; url?: string }
  | { type: "comparison"; left: string[]; right: string[] };

export type Section = {
  heading: string;
  blocks: ContentBlock[];
};

export type StructuredContent = {
  title?: string;
  sections: Section[];
};

export type TemplateRegionRole =
  | "title"
  | "body"
  | "image"
  | "column"
  | "footer";

export type CoreTemplateRegion = {
  id: string;
  role: TemplateRegionRole;
  maxChars?: number;
  layout: { x: number; y: number; w: number; h: number };
};

export type MappingRule = {
  id: string;
  description?: string;
};

export type TemplateSlide = {
  id: string;
  regions: CoreTemplateRegion[];
  rules?: MappingRule[];
  /** Preserved from imported packs for catalog / legacy UI */
  mappingPresetId?: TemplatePresetId;
  slidePreviewDataUrl?: string;
};

export type Template = {
  id: string;
  slides: TemplateSlide[];
};

export type SlideModel = {
  companyTemplateId: string;
  templateSlideId: string;
  regions: { regionId: string; content: string | string[] }[];
};

/** Internal units produced from structured content before scoring. */
export type SlideUnit =
  | { kind: "title"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "comparison"; left: string[]; right: string[] }
  | { kind: "image"; url?: string }
  /** One wizard/deck row: heading + optional subtitle + bullets (no duplicate title in body). */
  | {
      kind: "section_row";
      title: string;
      subtitle: string;
      bullets: string[];
    };
