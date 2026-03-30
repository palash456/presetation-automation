import type { TemplateAlternative, TemplatePresetId } from "./types";

export const TEMPLATE_CATALOG: Record<
  TemplatePresetId,
  { name: string; shortLabel: string }
> = {
  "title-hero": { name: "Title — Hero", shortLabel: "Hero title" },
  "content-classic": { name: "Content — Classic", shortLabel: "Classic" },
  "comparison-split": { name: "Comparison — Split", shortLabel: "Compare" },
  "data-focus": { name: "Data — Focus", shortLabel: "Data" },
  "section-minimal": { name: "Section — Minimal", shortLabel: "Section" },
};

export const ALL_TEMPLATE_IDS = Object.keys(
  TEMPLATE_CATALOG,
) as TemplatePresetId[];

export function defaultAlternatives(
  current: TemplatePresetId,
  excludeId?: TemplatePresetId,
  allowedPool?: TemplatePresetId[] | null,
): TemplateAlternative[] {
  let pool = ALL_TEMPLATE_IDS.filter((id) => id !== current && id !== excludeId);
  if (allowedPool && allowedPool.length > 0) {
    const restricted = pool.filter((id) => allowedPool.includes(id));
    if (restricted.length > 0) pool = restricted;
  }
  const pick = (id: TemplatePresetId, score: number, reasoning: string) => ({
    id,
    name: TEMPLATE_CATALOG[id].name,
    matchScore: score,
    reasoning,
  });
  const reasons: Partial<Record<TemplatePresetId, string>> = {
    "title-hero":
      "Strong when a single headline and hero visual carry the slide.",
    "content-classic":
      "Best for narrative bullets with optional supporting visual.",
    "comparison-split":
      "Fits side-by-side arguments, before/after, or A vs B framing.",
    "data-focus": "Prioritizes charts, KPIs, and numeric callouts.",
    "section-minimal": "Clean chapter divider with low visual noise.",
  };
  return pool.slice(0, 4).map((id, i) =>
    pick(
      id,
      72 - i * 6 + (id.length % 5),
      reasons[id] ?? "Viable alternative for this content shape.",
    ),
  );
}
