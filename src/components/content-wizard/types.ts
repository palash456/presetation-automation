export type EntryMethod = "upload" | "paste" | "ai";

export type FieldLimits = {
  title: number;
  subtitle: number;
  bulletLine: number;
  notes: number;
};

export type SlideContent = {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  notes: string;
  /** Labels for media slots, e.g. "Hero image", "Chart" */
  mediaPlaceholders: string[];
  /** 0–100, template fit heuristic */
  templateMatchScore: number;
  limits: FieldLimits;
};

export function countBulletsChars(bullets: string[]): number {
  return bullets.reduce((n, b) => n + b.length, 0);
}

export function slideHasOverflow(s: SlideContent): {
  title: boolean;
  subtitle: boolean;
  bullets: boolean;
  notes: boolean;
} {
  const bulletLineOverflow = s.bullets.some(
    (line) => line.length > s.limits.bulletLine,
  );
  const totalBulletBudget = s.limits.bulletLine * 12;
  return {
    title: s.title.length > s.limits.title,
    subtitle: s.subtitle.length > s.limits.subtitle,
    bullets: bulletLineOverflow || countBulletsChars(s.bullets) > totalBulletBudget,
    notes: s.notes.length > s.limits.notes,
  };
}
