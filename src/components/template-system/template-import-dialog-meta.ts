import type { AddTemplateSource } from "./add-template-source";

export function importPipelineDialogMeta(
  source: AddTemplateSource,
  fileName?: string,
): { title: string; body: string } {
  switch (source) {
    case "deck":
      return {
        title: "Deck import",
        body: fileName
          ? `“${fileName}” is not a .pptx file, or it could not be read in the browser. For PowerPoint, use a .pptx export. You can also import a JSON template pack from the template library.`
          : "Choose a .pptx file — slide shapes are converted to editable regions. Other formats are not parsed locally yet.",
      };
    case "figma":
      return {
        title: "Figma connection",
        body:
          "Paste a Figma file or frame link in the template library (or connect the Figma integration when enabled). We sync frames as normalized regions and preserve component constraints for export.",
      };
    case "code":
      return {
        title: "Code / schema import",
        body:
          "Paste JSON from design codegen, a React layout tree, or your own schema. We validate against the slide template shape (regions, spacing, mappingPresetId) and merge into the active pack.",
      };
    case "google_slides":
      return {
        title: "Google Slides",
        body:
          "Use a view-only link to pull slide order, titles, and speaker notes. Slides map into our outline and template rails without editing your source deck.",
      };
    case "canva":
      return {
        title: "Canva export",
        body:
          "Upload a PDF export or share a design link. We approximate frames from vector PDFs and match colors/typography to your brand tokens when available.",
      };
    case "brand_kit":
      return {
        title: "Brand kit (ZIP)",
        body:
          "Include logos (SVG/PNG), font files, and a tokens.json or design-tokens YAML. We seed colors, type scales, and spacing defaults for a new presentation style.",
      };
    default:
      return {
        title: "Import",
        body: "Continue in the template library to finish this import.",
      };
  }
}
