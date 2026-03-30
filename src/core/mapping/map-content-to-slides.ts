import type {
  SlideModel,
  SlideUnit,
  Section,
  StructuredContent,
  Template,
  TemplateSlide,
} from "../types";

/** One slide candidate per section (deck row / pasted chunk), preserves title vs body. */
export function sectionToSlideUnit(section: Section): SlideUnit {
  const h = section.heading.trim();
  const comp = section.blocks.find((b) => b.type === "comparison");
  const img = section.blocks.find((b) => b.type === "image");
  const bulletsBlocks = section.blocks.filter((b) => b.type === "bullets");
  const paraBlocks = section.blocks.filter((b) => b.type === "paragraph");

  if (comp) {
    return { kind: "comparison", left: comp.left, right: comp.right };
  }
  if (img?.url) {
    return { kind: "image", url: img.url };
  }

  const bullets = bulletsBlocks.flatMap((b) =>
    b.type === "bullets" ? b.items : [],
  );
  const paragraphs = paraBlocks
    .map((b) => (b.type === "paragraph" ? b.text.trim() : ""))
    .filter(Boolean);

  if (bullets.length > 0 || paragraphs.length > 0) {
    const subtitle = paragraphs[0] ?? "";
    const restParagraphs = paragraphs.slice(1);
    const allBullets = [...bullets, ...restParagraphs];
    return {
      kind: "section_row",
      title: h || "Slide",
      subtitle,
      bullets: allBullets,
    };
  }

  if (h) return { kind: "title", text: h };
  return { kind: "paragraph", text: "—" };
}

/** Flatten structured doc → slide units (deck title optional opener + one unit per section). */
export function structuredContentToSlideUnits(
  content: StructuredContent,
): SlideUnit[] {
  const units: SlideUnit[] = [];
  const docTitle = content.title?.trim();
  if (docTitle && content.sections[0]?.heading.trim() !== docTitle) {
    units.push({ kind: "title", text: docTitle });
  }
  for (const section of content.sections) {
    units.push(sectionToSlideUnit(section));
  }
  return units;
}

export function scoreTemplateSlide(unit: SlideUnit, ts: TemplateSlide): number {
  let score = 0;
  const hasTitle = ts.regions.some((r) => r.role === "title");
  const hasBody = ts.regions.some((r) => r.role === "body");
  const hasImage = ts.regions.some((r) => r.role === "image");
  const colCount = ts.regions.filter((r) => r.role === "column").length;

  switch (unit.kind) {
    case "title":
      if (hasTitle) score += 20;
      if (!hasBody && ts.regions.length <= 3) score += 8;
      break;
    case "paragraph":
    case "bullets":
      if (hasBody) score += 16;
      if (hasTitle && hasBody) score += 6;
      if (unit.kind === "bullets" && ts.regions.filter((r) => r.role === "body").length >= 2) {
        score += 2;
      }
      break;
    case "comparison":
      if (colCount >= 2) score += 22;
      else if (hasBody) score += 10;
      break;
    case "image":
      if (hasImage) score += 18;
      break;
    case "section_row":
      if (hasTitle) score += 12;
      if (hasBody) score += 14;
      if (hasTitle && hasBody && unit.bullets.length > 0) score += 8;
      if (unit.subtitle.trim() && hasBody) score += 4;
      break;
    default:
      break;
  }

  score += ts.regions.length * 0.4;
  return score;
}

export function pickBestTemplateSlide(
  unit: SlideUnit,
  templateSlides: TemplateSlide[],
): TemplateSlide {
  if (templateSlides.length === 0) {
    throw new Error("Template has no slides");
  }
  let best = templateSlides[0]!;
  let bestScore = -Infinity;
  for (const s of templateSlides) {
    const sc = scoreTemplateSlide(unit, s);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return best;
}

function extractTitleFromUnit(unit: SlideUnit): string {
  switch (unit.kind) {
    case "title":
      return unit.text;
    case "section_row":
      return unit.title;
    case "paragraph":
      return unit.text.slice(0, 240);
    case "bullets":
      return unit.items[0] ?? "Slide";
    case "comparison":
      return "Comparison";
    case "image":
      return "";
    default:
      return "";
  }
}

function extractBodyFromUnit(unit: SlideUnit): string {
  switch (unit.kind) {
    case "section_row": {
      const parts: string[] = [];
      if (unit.subtitle.trim()) parts.push(unit.subtitle.trim());
      if (unit.bullets.length) {
        parts.push(unit.bullets.map((b) => `• ${b}`).join("\n"));
      }
      return parts.join("\n\n");
    }
    case "paragraph":
      return unit.text;
    case "bullets":
      return unit.items.map((b) => `• ${b}`).join("\n");
    case "comparison":
      return [...unit.left.map((l) => `• ${l}`), ...unit.right.map((r) => `• ${r}`)].join(
        "\n",
      );
    case "title":
      return "";
    case "image":
      return "";
    default:
      return "";
  }
}

function extractFooterFromUnit(unit: SlideUnit): string {
  if (unit.kind === "section_row") return unit.subtitle.trim();
  return "";
}

export function mapUnitToSlideRegions(
  unit: SlideUnit,
  templateSlide: TemplateSlide,
): { regionId: string; content: string | string[] }[] {
  const columns = templateSlide.regions.filter((r) => r.role === "column");

  return templateSlide.regions.map((r) => {
    switch (r.role) {
      case "title":
        return { regionId: r.id, content: extractTitleFromUnit(unit) };
      case "body": {
        const raw = extractBodyFromUnit(unit);
        const capped =
          r.maxChars && r.maxChars > 0 && raw.length > r.maxChars
            ? `${raw.slice(0, Math.max(0, r.maxChars - 1))}…`
            : raw;
        return { regionId: r.id, content: capped };
      }
      case "footer":
        return { regionId: r.id, content: extractFooterFromUnit(unit) };
      case "image":
        return {
          regionId: r.id,
          content: unit.kind === "image" && unit.url ? unit.url : "",
        };
      case "column": {
        if (unit.kind === "comparison" && columns.length >= 2) {
          const idx = columns.findIndex((c) => c.id === r.id);
          return {
            regionId: r.id,
            content: idx === 0 ? unit.left : unit.right,
          };
        }
        return {
          regionId: r.id,
          content: extractBodyFromUnit(unit),
        };
      }
      default:
        return { regionId: r.id, content: extractBodyFromUnit(unit) };
    }
  });
}

export function createSlideModel(
  unit: SlideUnit,
  templateSlide: TemplateSlide,
  companyTemplateId: string,
): SlideModel {
  return {
    companyTemplateId,
    templateSlideId: templateSlide.id,
    regions: mapUnitToSlideRegions(unit, templateSlide),
  };
}

export function mapContentToSlides(
  content: StructuredContent,
  template: Template,
  companyTemplateId: string,
): SlideModel[] {
  const units = structuredContentToSlideUnits(content);
  if (units.length === 0) {
    return [];
  }
  return units.map((unit) => {
    const best = pickBestTemplateSlide(unit, template.slides);
    return createSlideModel(unit, best, companyTemplateId);
  });
}
