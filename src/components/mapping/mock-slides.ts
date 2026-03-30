export const REASONING_POOL = [
  "Layout rails align with your bullet depth and title length.",
  "Template reserves space for the media slots implied by structure.",
  "Typography scale fits headline hierarchy without overflow.",
  "Comparison template matches paired clauses in body text.",
  "Data template optimizes for dense numeric lines and a chart band.",
  "Section divider keeps cognitive load low for chapter transitions.",
] as const;

/** Deterministic copy — no random demo jitter. */
export function reasoningAt(index: number): string {
  const i =
    ((index % REASONING_POOL.length) + REASONING_POOL.length) %
    REASONING_POOL.length;
  return REASONING_POOL[i]!;
}

/** Stable score variation from a string salt (e.g. slide or layout id). */
export function scoreFromSalt(base: number, salt: string): number {
  let h = 0;
  for (let i = 0; i < salt.length; i++) {
    h = (h * 31 + salt.charCodeAt(i)) | 0;
  }
  const jitter = (Math.abs(h) % 9) - 4;
  const n = base + jitter;
  return Math.min(99, Math.max(52, n));
}
