import type { SlideContent } from "@/components/content-wizard/types";
import type { ContentBlock, Section, StructuredContent } from "../types";

/**
 * One deck row → one section (keeps wizard slide count stable; mapping engine
 * scores one best template slide per section).
 */
export function structuredContentCompactFromRows(
  rows: SlideContent[],
): StructuredContent {
  if (rows.length === 0) {
    return { title: undefined, sections: [] };
  }
  return {
    title: rows[0]?.title.trim() || undefined,
    sections: rows.map((row) => ({
      heading: row.title.trim() || "Slide",
      blocks: [
        ...(row.subtitle.trim()
          ? [{ type: "paragraph" as const, text: row.subtitle.trim() }]
          : []),
        ...(row.bullets.length > 0
          ? [{ type: "bullets" as const, items: [...row.bullets] }]
          : []),
        ...(row.notes.trim()
          ? [{ type: "paragraph" as const, text: row.notes.trim() }]
          : []),
      ],
    })),
  };
}

/** Bridge legacy outline rows → structured content for the mapping engine. */
export function structuredContentFromSlideRows(rows: SlideContent[]): StructuredContent {
  if (rows.length === 0) {
    return { title: undefined, sections: [] };
  }

  const sections: Section[] = rows.map((row) => {
    const blocks: ContentBlock[] = [];
    if (row.subtitle.trim()) {
      blocks.push({ type: "paragraph", text: row.subtitle.trim() });
    }
    if (row.bullets.length > 0) {
      blocks.push({ type: "bullets", items: [...row.bullets] });
    }
    if (row.notes.trim()) {
      blocks.push({ type: "paragraph", text: row.notes.trim() });
    }
    if (blocks.length === 0) {
      blocks.push({ type: "paragraph", text: row.title || "—" });
    }
    return {
      heading: row.title.trim() || "Slide",
      blocks,
    };
  });

  return {
    title: rows[0]?.title.trim() || undefined,
    sections,
  };
}
