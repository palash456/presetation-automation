import type { StructuredContent } from "../types";

/** No demo deck: honest placeholder until binary upload parsing exists. */
export function structuredContentFromUploadPlaceholder(fileLabel: string): StructuredContent {
  const base = fileLabel.replace(/\.[^./\\]+$/i, "").trim() || "Upload";
  return normalizeMinimal({
    title: base,
    sections: [
      {
        heading: base,
        blocks: [
          {
            type: "paragraph",
            text: `You selected “${fileLabel}”. File text is not extracted in the browser yet — edit this outline below or paste content to drive template mapping.`,
          },
          {
            type: "bullets",
            items: [
              "Add bullets in the Content step",
              "Or switch to Paste / AI to generate structure",
            ],
          },
        ],
      },
    ],
  });
}

function normalizeMinimal(s: StructuredContent): StructuredContent {
  return {
    title: s.title,
    sections: s.sections.filter((x) => x.heading || x.blocks.length),
  };
}
