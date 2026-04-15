import type { ContentBlock, Section, StructuredContent } from "../types";

function inferBlockTypeFromLines(lines: string[]): ContentBlock {
  const bulletish = lines.some((l) => /^[-•*]\s/.test(l) || /^\d+\.\s/.test(l));
  if (bulletish) {
    return {
      type: "bullets",
      items: lines.map((l) =>
        l.replace(/^[-•*]\s*|^\d+\.\s*/, "").trim(),
      ).filter(Boolean),
    };
  }
  return { type: "paragraph", text: lines.join("\n") };
}

/** Plain text / paste → rich structured content (paragraphs → sections). */
export function structuredFromPlainText(text: string): StructuredContent {
  const chunks = text
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const blocks = chunks.length ? chunks : [text.trim() || "Untitled"];

  const sections: Section[] = blocks.slice(0, 24).map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const heading = lines[0] ?? "Slide";
    const rest = lines.slice(1);
    const sectionBlocks: ContentBlock[] = [];

    if (rest.length === 0) {
      sectionBlocks.push({ type: "paragraph", text: heading });
    } else {
      const maybeSubtitle = rest[0];
      const hasBulletFirst =
        maybeSubtitle &&
        (/^[-•*]/.test(maybeSubtitle) || /^\d+\.\s/.test(maybeSubtitle));
      if (maybeSubtitle && !hasBulletFirst) {
        sectionBlocks.push({ type: "paragraph", text: maybeSubtitle });
        const tail = rest.slice(1);
        if (tail.length) sectionBlocks.push(inferBlockTypeFromLines(tail));
      } else {
        sectionBlocks.push(inferBlockTypeFromLines(rest));
      }
    }

    return { heading, blocks: sectionBlocks };
  });

  return {
    title: sections[0]?.heading,
    sections,
  };
}
