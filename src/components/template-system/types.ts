export type TemplateStatus = "processed" | "needs_review";

export type LayoutRule = "fixed" | "flexible";

export type ContentDensity = "low" | "medium" | "high";

export type RegionKind =
  | "text"
  | "image"
  | "shape"
  | "chart"
  | "icon";

export type TemplateRegion = {
  id: string;
  label: string;
  kind: RegionKind;
  /** Normalized 0–1 coords inside the slide frame */
  x: number;
  y: number;
  w: number;
  h: number;
  maxChars: number;
  /** When set, element is not draggable/resizable on canvas. */
  locked?: boolean;
  shapeVariant?: "rect" | "circle";
  /** Image / placeholder regions: keep aspect on resize. */
  aspectLocked?: boolean;
  imageFit?: "cover" | "contain";
  textAlign?: "start" | "center" | "end";
  overflow?: "clip" | "ellipsis";
};

export type SlideTemplateDefinition = {
  id: string;
  name: string;
  useCase: string;
  status: TemplateStatus;
  templateType: string;
  regions: TemplateRegion[];
  layoutRule: LayoutRule;
  spacing: { padding: number; margin: number };
  designTags: string[];
  density: ContentDensity;
  allowedElements: string[];
  /**
   * Raster preview of the slide (e.g. from PPTX import): JPEG data URL, drawn behind regions on the canvas.
   * Can be large; omitted when not generated.
   */
  slidePreviewDataUrl?: string;
};

export type AiSuggestion = {
  id: string;
  field: string;
  value: string;
  confidence: number;
};
