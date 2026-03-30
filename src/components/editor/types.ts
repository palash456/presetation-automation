export type TextAlign = "left" | "center" | "right";

export type PlaceholderKind = "image" | "chart" | "shape" | "icon";

export type EditorTextElement = {
  type: "text";
  id: string;
  /** Template role label for constraints panel */
  role: string;
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked: boolean;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  align: TextAlign;
};

export type EditorPlaceholderElement = {
  type: "placeholder";
  id: string;
  role: string;
  placeholderKind: PlaceholderKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked: boolean;
};

export type EditorElement = EditorTextElement | EditorPlaceholderElement;

export type EditorSlide = {
  id: string;
  /** Content inset inside template rails (px, conceptual) */
  padding: number;
  /** Vertical rhythm between blocks */
  spacing: number;
  /** Slide-level content alignment */
  align: TextAlign;
  elements: EditorElement[];
};
