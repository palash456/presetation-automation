import type { SlideContent, SlideType } from "./types";

const DEFAULT_LIMITS = {
  title: 72,
  subtitle: 140,
  bulletLine: 96,
  notes: 480,
} as const;

function inferTypeFromIndex(i: number, firstLine: string): SlideType {
  if (i === 0) return "title";
  if (/^agenda|^outline|^overview/i.test(firstLine)) return "section";
  if (/vs\.|versus|compare/i.test(firstLine)) return "comparison";
  if (/\d+%|\$\d|kpi|metric/i.test(firstLine)) return "data";
  if (/thank|q\s*&\s*a|closing/i.test(firstLine)) return "closing";
  return "content";
}

/** Build slides from pasted or AI-generated plain text (paragraphs → slides). */
export function slidesFromPlainText(text: string): SlideContent[] {
  const chunks = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const paras = chunks.length ? chunks : [text.trim() || "Untitled deck"];

  return paras.slice(0, 12).map((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] ?? `Slide ${i + 1}`;
    const rest = lines.slice(1);
    const subtitle = rest[0] && !rest[0].startsWith("•") && !rest[0].startsWith("-")
      ? rest.shift()!
      : "";
    const bulletLines = rest.length
      ? rest
      : i > 0
        ? ["Add supporting points for this slide."]
        : [];
    const bullets = bulletLines.map((l) =>
      l.replace(/^[-•*]\s*/, "").trim(),
    );

    const st = inferTypeFromIndex(i, title);
    const scoreBase =
      st === "title" ? 92 : st === "content" ? 78 : st === "data" ? 71 : 74;
    const score = Math.min(99, scoreBase - i * 2 + (title.length % 7));

    return {
      id: `slide-${i + 1}-${Date.now().toString(36)}`,
      title,
      subtitle,
      bullets: bullets.length ? bullets : [],
      notes: "",
      mediaPlaceholders:
        st === "title"
          ? ["Hero image"]
          : st === "data"
            ? ["Chart or table"]
            : st === "comparison"
              ? ["Left visual", "Right visual"]
              : [],
      slideType: st,
      templateMatchScore: score,
      limits: { ...DEFAULT_LIMITS },
    };
  });
}

export const DEMO_SLIDES_SEED: SlideContent[] = [
  {
    id: "demo-1",
    title: "Product narrative — H2 2025",
    subtitle: "Growth, retention, and the next bets",
    bullets: [],
    notes: "Open with customer quote if time allows.",
    mediaPlaceholders: ["Hero image"],
    slideType: "title",
    templateMatchScore: 94,
    limits: { ...DEFAULT_LIMITS },
  },
  {
    id: "demo-2",
    title: "Where we are today",
    subtitle: "Three signals that matter",
    bullets: [
      "Activation up 12% QoQ after onboarding refresh.",
      "Enterprise pipeline weighted toward Q3 close — watch discounting.",
      "Support CSAT stable; doc gaps drive ~18% of tickets.",
    ],
    notes: "Emphasize activation — leadership cares most here.",
    mediaPlaceholders: ["Trend chart"],
    slideType: "content",
    templateMatchScore: 81,
    limits: { ...DEFAULT_LIMITS },
  },
  {
    id: "demo-3",
    title: "Build vs buy — decision frame",
    subtitle: "",
    bullets: [
      "Time-to-value: build wins if team staffed; buy if <90d deadline.",
      "TCO 3yr: include maintenance and vendor lock-in.",
      "Risk: compliance and data residency non-negotiable for FSI.",
    ],
    notes: "",
    mediaPlaceholders: ["Comparison diagram"],
    slideType: "comparison",
    templateMatchScore: 76,
    limits: { ...DEFAULT_LIMITS },
  },
];
