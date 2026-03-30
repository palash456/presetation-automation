import { defaultAlternatives } from "./template-catalog";
import type { MappingSlide, TemplatePresetId } from "./types";

export const REASONING_POOL = [
  "Layout rails align with your bullet depth and title length.",
  "Template reserves space for the media slots implied by structure.",
  "Typography scale fits headline hierarchy without overflow.",
  "Comparison template matches paired clauses in body text.",
  "Data template optimizes for dense numeric lines and a chart band.",
  "Section divider keeps cognitive load low for chapter transitions.",
] as const;

export function randomReasoning(): string {
  return REASONING_POOL[Math.floor(Math.random() * REASONING_POOL.length)]!;
}

export function jitterScore(base: number): number {
  const n = base + Math.floor(Math.random() * 9) - 4;
  return Math.min(99, Math.max(52, n));
}

export function remapAlternatives(
  current: TemplatePresetId,
  pool?: TemplatePresetId[] | null,
): MappingSlide["alternatives"] {
  return defaultAlternatives(current, undefined, pool);
}
