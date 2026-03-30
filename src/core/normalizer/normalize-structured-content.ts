import type { ContentBlock, StructuredContent } from "../types";

function trimBlock(b: ContentBlock): ContentBlock {
  switch (b.type) {
    case "paragraph":
      return { type: "paragraph", text: b.text.replace(/\s+/g, " ").trim() };
    case "bullets":
      return {
        type: "bullets",
        items: b.items.map((x) => x.trim()).filter(Boolean).slice(0, 40),
      };
    case "comparison":
      return {
        type: "comparison",
        left: b.left.map((x) => x.trim()).filter(Boolean),
        right: b.right.map((x) => x.trim()).filter(Boolean),
      };
    case "image":
      return { type: "image", url: b.url?.trim() };
    default:
      return b;
  }
}

export function normalizeStructuredContent(input: StructuredContent): StructuredContent {
  const title = input.title?.trim() || undefined;
  const sections = input.sections
    .map((s) => ({
      heading: s.heading.trim(),
      blocks: s.blocks.map(trimBlock).filter((b) => {
        if (b.type === "paragraph") return b.text.length > 0;
        if (b.type === "bullets") return b.items.length > 0;
        if (b.type === "comparison") return b.left.length + b.right.length > 0;
        if (b.type === "image") return Boolean(b.url);
        return true;
      }),
    }))
    .filter((s) => s.heading.length > 0 || s.blocks.length > 0);

  return { title, sections };
}
