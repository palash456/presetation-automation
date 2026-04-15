import type { LucideIcon } from "lucide-react";
import {
  Code2,
  FileJson,
  Layers,
  Package,
  Palette,
  PenTool,
  Presentation,
  Sparkles,
} from "lucide-react";
import type { AddTemplateSource } from "./add-template-source";

export const ADD_TEMPLATE_OPTIONS: {
  source: AddTemplateSource;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    source: "blank",
    label: "Blank style in editor",
    description: "Start from a base layout set and define regions manually.",
    icon: Layers,
  },
  {
    source: "json",
    label: "JSON template pack",
    description: "Upload definitions matching our slide template schema.",
    icon: FileJson,
  },
  {
    source: "deck",
    label: "Deck file import",
    description: "PowerPoint (.pptx), Keynote, or PDF — extract masters and boxes.",
    icon: Presentation,
  },
  {
    source: "figma",
    label: "Figma import",
    description: "File or frame URL — sync frames as layout references.",
    icon: PenTool,
  },
  {
    source: "code",
    label: "Code / schema import",
    description: "JSON from codegen, design tokens, or React layout descriptors.",
    icon: Code2,
  },
  {
    source: "google_slides",
    label: "Google Slides",
    description: "Paste a view-only link — pull titles, notes, and structure.",
    icon: Sparkles,
  },
  {
    source: "canva",
    label: "Canva export",
    description: "PDF export or packaged design link for layout matching.",
    icon: Palette,
  },
  {
    source: "brand_kit",
    label: "Brand kit (ZIP)",
    description: "Logos, fonts, colors, and tokens to seed a new design system.",
    icon: Package,
  },
];
