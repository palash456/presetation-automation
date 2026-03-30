import {
  slideHasOverflow,
  type SlideContent,
} from "@/components/content-wizard/types";
import type { DeckSlide } from "./types";

export function computeTemplateMatchScore(s: SlideContent): number {
  let base = 72;
  if (
    s.slideType === "title" &&
    s.title.length > 0 &&
    s.title.length <= s.limits.title
  ) {
    base = 90;
  }
  if (s.slideType === "content" && s.bullets.length >= 2) base += 6;
  if (s.slideType === "comparison" && s.bullets.length >= 2) base += 4;
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
  const layoutBreakRisk =
    s.bullets.length > 7 || (s.slideType === "title" && s.bullets.length > 2);
  return {
    ...s,
    templateMatchScore: computeTemplateMatchScore(s),
    overflowRisk,
    layoutBreakRisk,
  };
}
