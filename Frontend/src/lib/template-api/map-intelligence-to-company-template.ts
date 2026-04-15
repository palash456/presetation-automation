import type { CompanyTemplate } from "@/components/template-system/company-types";
import type {
  ContentDensity,
  SlideTemplateDefinition,
  TemplateRegion,
} from "@/components/template-system/types";

type Position = {
  x?: number;
  y?: number;
  xPct?: number;
  yPct?: number;
} | null;

type Size = {
  width?: number;
  height?: number;
  widthPct?: number;
  heightPct?: number;
} | null;

type IntelligenceTextBlock = {
  blockId: string;
  text: string;
  position: Position;
  size: Size;
  charCount?: number;
  role?: string | null;
  alignment?: string | null;
};

type SlideConstraints = {
  maxTitleChars?: number | null;
  maxBodyChars?: number | null;
  maxCharsPerBullet?: number | null;
};

type IntelligenceSlide = {
  index: number;
  slideType: string;
  confidence?: number;
  signals?: string[];
  layoutPattern?: string;
  elements: IntelligenceTextBlock[];
  constraints?: SlideConstraints;
  contentModel?: { title?: string | null };
};

type DesignSystem = {
  typography?: { primaryFont?: string | null; fonts?: string[] };
  colors?: { primary?: string | null; accent?: string | null };
};

export type PresentationIntelligence = {
  version: string;
  designSystem?: DesignSystem;
  slides: IntelligenceSlide[];
  meta?: { totalSlides?: number; processingNotes?: string[] };
};

export type UploadMetadata = {
  intelligence: PresentationIntelligence | null;
  intelligenceError?: string | null;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function mapTextAlign(
  a: string | null | undefined,
): "start" | "center" | "end" | undefined {
  if (!a) return undefined;
  const v = String(a).toLowerCase();
  if (v === "center") return "center";
  if (v === "right") return "end";
  return "start";
}

function roleCharCap(
  role: string | undefined | null,
  c: SlideConstraints | undefined,
): number {
  const r = role ?? "body";
  if (r === "title") return c?.maxTitleChars ?? 220;
  if (r === "subtitle") return c?.maxTitleChars ?? 280;
  if (r === "bullet") return c?.maxCharsPerBullet ?? 400;
  return c?.maxBodyChars ?? 2400;
}

function maxCharsForBlock(
  block: IntelligenceTextBlock,
  constraints: SlideConstraints | undefined,
): number {
  const cap = roleCharCap(block.role, constraints);
  const base =
    typeof block.charCount === "number" && block.charCount > 0
      ? Math.ceil(block.charCount * 1.35) + 32
      : 200;
  return clamp(Math.max(base, 80), 40, cap);
}

function labelFromBlock(block: IntelligenceTextBlock): string {
  const t = block.text.replace(/\s+/g, " ").trim();
  if (t.length <= 72) return t || block.blockId;
  return `${t.slice(0, 69)}…`;
}

function elementToRegion(
  block: IntelligenceTextBlock,
  slideIndex: number,
  regionIndex: number,
  constraints: SlideConstraints | undefined,
): TemplateRegion | null {
  const pos = block.position;
  const sz = block.size;
  const xPct = pos && typeof pos.xPct === "number" ? pos.xPct : null;
  const yPct = pos && typeof pos.yPct === "number" ? pos.yPct : null;
  const wPct = sz && typeof sz.widthPct === "number" ? sz.widthPct : null;
  const hPct = sz && typeof sz.heightPct === "number" ? sz.heightPct : null;
  if (
    xPct == null ||
    yPct == null ||
    wPct == null ||
    hPct == null ||
    !Number.isFinite(xPct + yPct + wPct + hPct)
  ) {
    return null;
  }
  const x = clamp(xPct, 0, 0.98);
  const y = clamp(yPct, 0, 0.98);
  const w = clamp(wPct, 0.02, 1 - x);
  const h = clamp(hPct, 0.02, 1 - y);
  if (w < 0.02 || h < 0.02) return null;

  return {
    id: `reg-api-s${slideIndex}-${regionIndex}-${block.blockId.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    label: labelFromBlock(block),
    kind: "text",
    x,
    y,
    w,
    h,
    maxChars: maxCharsForBlock(block, constraints),
    textAlign: mapTextAlign(block.alignment) ?? "start",
    overflow: "clip",
  };
}

function fallbackRegions(slideIndex: number): TemplateRegion[] {
  return [
    {
      id: `reg-api-s${slideIndex}-fallback`,
      label: "Body",
      kind: "text",
      x: 0.08,
      y: 0.15,
      w: 0.84,
      h: 0.72,
      maxChars: 800,
      textAlign: "start",
      overflow: "clip",
    },
  ];
}

function densityForSlide(elCount: number): ContentDensity {
  if (elCount >= 10) return "high";
  if (elCount >= 5) return "medium";
  return "low";
}

function slideToDefinition(
  slide: IntelligenceSlide,
): SlideTemplateDefinition {
  const constraints = slide.constraints;
  const regions: TemplateRegion[] = [];
  let ri = 0;
  for (const el of slide.elements) {
    const r = elementToRegion(el, slide.index, ri, constraints);
    if (r) {
      regions.push(r);
      ri++;
    }
  }

  const finalRegions =
    regions.length > 0 ? regions : fallbackRegions(slide.index);

  const titleHint = slide.contentModel?.title?.trim();
  const name =
    slide.index === 0 && titleHint
      ? `Title — ${titleHint.slice(0, 48)}${titleHint.length > 48 ? "…" : ""}`
      : `Slide ${slide.index + 1}`;

  const designTags = [
    slide.slideType,
    slide.layoutPattern ?? "",
    ...(slide.signals ?? []),
  ]
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: `import-slide-${slide.index + 1}`,
    name,
    useCase: slide.index === 0 ? "Title" : "Content",
    status: "needs_review",
    templateType: slide.slideType || "Content",
    regions: finalRegions.filter((r) => r.w >= 0.02 && r.h >= 0.02),
    layoutRule: "flexible",
    spacing: { padding: 40, margin: 48 },
    designTags,
    density: densityForSlide(slide.elements.length),
    allowedElements: ["text", "image", "chart", "shape"],
  };
}

/**
 * Builds the in-app `CompanyTemplate` from backend `/upload` metadata
 * (`metadata.intelligence`), using server-side layout and text estimates.
 */
export function mapUploadMetadataToCompanyTemplate(
  metadata: UploadMetadata,
  originalFileName: string,
): CompanyTemplate {
  const { intelligence, intelligenceError } = metadata;
  if (!intelligence?.slides?.length) {
    const hint =
      typeof intelligenceError === "string" && intelligenceError.length > 0
        ? ` (${intelligenceError})`
        : "";
    throw new Error(
      `No slide intelligence in upload response.${hint} Try another .pptx or check the parser service.`,
    );
  }

  const slides = [...intelligence.slides].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  const slideTemplates = slides.map(slideToDefinition);

  const baseName =
    originalFileName.replace(/\.pptx$/i, "").replace(/\.ppt$/i, "") ||
    "Imported deck";
  const primaryFont = intelligence.designSystem?.typography?.primaryFont;
  const styleTags = [
    "Imported",
    "API",
    ...(primaryFont ? [primaryFont] : []),
  ].filter(Boolean);

  return {
    id: `co-api-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: baseName,
    shortDescription: `${baseName} · ${slideTemplates.length} slide(s) · parsed server-side`,
    industry: "General",
    style: "Minimal",
    presentationUseCases: ["Internal"],
    styleTags,
    slideTemplates,
  };
}
