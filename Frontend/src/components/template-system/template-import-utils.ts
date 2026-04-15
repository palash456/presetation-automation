import type {
  ContentDensity,
  LayoutRule,
  RegionKind,
  SlideTemplateDefinition,
  TemplateRegion,
  TemplateStatus,
} from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function coerceNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

const REGION_KINDS: Set<string> = new Set([
  "text",
  "image",
  "shape",
  "chart",
  "icon",
]);

function coerceRegion(r: unknown): TemplateRegion | null {
  if (!isRecord(r)) return null;
  const kindRaw = r.kind;
  const kind: RegionKind = REGION_KINDS.has(String(kindRaw))
    ? (kindRaw as RegionKind)
    : "text";
  if (typeof r.id !== "string" || typeof r.label !== "string") return null;
  const shapeVariant =
    r.shapeVariant === "circle" ? "circle" : r.shapeVariant === "rect" ? "rect" : undefined;
  const imageFit =
    r.imageFit === "contain" ? "contain" : r.imageFit === "cover" ? "cover" : undefined;
  const textAlign =
    r.textAlign === "center" || r.textAlign === "end"
      ? r.textAlign
      : r.textAlign === "start"
        ? "start"
        : undefined;
  return {
    id: r.id,
    label: r.label,
    kind,
    x: coerceNumber(r.x, 0),
    y: coerceNumber(r.y, 0),
    w: coerceNumber(r.w, 0.5),
    h: coerceNumber(r.h, 0.2),
    maxChars: Math.max(0, Math.floor(coerceNumber(r.maxChars, 120))),
    locked: r.locked === true,
    ...(shapeVariant ? { shapeVariant } : {}),
    aspectLocked:
      r.aspectLocked === false
        ? false
        : kind === "image" || kind === "chart" || kind === "icon"
          ? r.aspectLocked !== false
          : undefined,
    ...(imageFit ? { imageFit } : {}),
    ...(textAlign ? { textAlign } : {}),
    overflow:
      r.overflow === "ellipsis"
        ? "ellipsis"
        : r.overflow === "clip"
          ? "clip"
          : undefined,
  };
}

function coerceSlideTemplateDefinition(
  o: unknown,
): SlideTemplateDefinition | null {
  if (!isRecord(o)) return null;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  if (!Array.isArray(o.regions)) return null;
  const regions = o.regions
    .map(coerceRegion)
    .filter((x): x is TemplateRegion => x !== null);
  if (regions.length === 0) return null;

  const status: TemplateStatus =
    o.status === "needs_review" ? "needs_review" : "processed";
  const layoutRule: LayoutRule =
    o.layoutRule === "flexible" ? "flexible" : "fixed";
  const densityRaw = o.density;
  const density: ContentDensity =
    densityRaw === "high" || densityRaw === "low" || densityRaw === "medium"
      ? densityRaw
      : "medium";

  const spacing = isRecord(o.spacing)
    ? {
        padding: Math.max(0, Math.floor(coerceNumber(o.spacing.padding, 40))),
        margin: Math.max(0, Math.floor(coerceNumber(o.spacing.margin, 48))),
      }
    : { padding: 40, margin: 48 };

  const designTags = Array.isArray(o.designTags)
    ? o.designTags.filter((t): t is string => typeof t === "string")
    : [];

  const allowedElements = Array.isArray(o.allowedElements)
    ? o.allowedElements.filter((t): t is string => typeof t === "string")
    : ["text", "image"];

  const useCase =
    typeof o.useCase === "string" && o.useCase ? o.useCase : "Content";
  const templateType =
    typeof o.templateType === "string" && o.templateType
      ? o.templateType
      : "Bullet slide";

  const slidePreviewDataUrl =
    typeof o.slidePreviewDataUrl === "string" &&
    o.slidePreviewDataUrl.startsWith("data:image/")
      ? o.slidePreviewDataUrl
      : undefined;

  return {
    id: o.id,
    name: o.name,
    useCase,
    status,
    templateType,
    regions,
    layoutRule,
    spacing,
    designTags,
    density,
    allowedElements,
    ...(slidePreviewDataUrl ? { slidePreviewDataUrl } : {}),
  };
}

/** Parses one template object, an array of templates, or `{ templates: [...] }`. */
export function parseTemplateDefinitionsFromJson(
  raw: unknown,
): SlideTemplateDefinition[] | null {
  let candidates: unknown[] = [];
  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (isRecord(raw)) {
    if (Array.isArray(raw.templates)) {
      candidates = raw.templates;
    } else if (Array.isArray(raw.slideTemplates)) {
      candidates = raw.slideTemplates;
    } else {
      candidates = [raw];
    }
  } else {
    return null;
  }

  const out: SlideTemplateDefinition[] = [];
  for (const c of candidates) {
    const t = coerceSlideTemplateDefinition(c);
    if (t) out.push(t);
  }
  return out.length > 0 ? out : null;
}
