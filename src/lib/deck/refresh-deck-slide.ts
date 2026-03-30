import {
  slideHasOverflow,
  type SlideContent,
} from "@/components/content-wizard/types";
import type { DeckSlide } from "./types";

/** Heuristic shape for template match score only (not stored on rows). */
function scoreShape(s: SlideContent): "title" | "comparison" | "content" {
  const titleOnly =
    s.title.trim().length > 0 &&
    s.subtitle.trim().length === 0 &&
    s.bullets.length === 0;
  if (
    titleOnly &&
    s.title.length > 0 &&
    s.title.length <= s.limits.title
  ) {
    return "title";
  }
  if (/vs\.|versus|compare/i.test(s.title)) return "comparison";
  return "content";
}

export function computeTemplateMatchScore(s: SlideContent): number {
  let base = 72;
  const shape = scoreShape(s);
  if (shape === "title") {
    base = 90;
  }
  if (shape === "content" && s.bullets.length >= 2) base += 6;
  if (shape === "comparison" && s.bullets.length >= 2) base += 4;
  const overflow = slideHasOverflow(s);
  if (
    overflow.title ||
    overflow.subtitle ||
    overflow.bullets ||
    overflow.notes
  ) {
    base -= 18;
  }
  return Math.min(99, Math.max(52, base));
}

export function refreshDerivedSlideFields(s: DeckSlide): DeckSlide {
  const ov = slideHasOverflow(s);
  const overflowRisk =
    ov.title || ov.subtitle || ov.bullets || ov.notes;
  const shape = scoreShape(s);
  const layoutBreakRisk =
    s.bullets.length > 7 || (shape === "title" && s.bullets.length > 2);
  return {
    ...s,
    templateMatchScore: computeTemplateMatchScore(s),
    overflowRisk,
    layoutBreakRisk,
  };
}
