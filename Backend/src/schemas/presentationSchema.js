/**
 * Zod schemas for PresentationIntelligence (Phase 7).
 * @module schemas/presentationSchema
 */

const { z } = require("zod");

const TextRunSchema = z.object({
  paragraphIndex: z.number().int(),
  runIndex: z.number().int(),
  text: z.string(),
  fontSize: z.number().nullable(),
  bold: z.boolean(),
  italic: z.boolean(),
  underline: z.boolean(),
  color: z.string().nullable(),
  fontFamily: z.string().nullable(),
  alignment: z.enum(["left", "center", "right", "justify"]).nullable(),
  indentLevel: z.number().int(),
  hasBullet: z.boolean(),
  bulletChar: z.string().nullable(),
});

const PositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    xPct: z.number(),
    yPct: z.number(),
  })
  .nullable();

const SizeSchema = z
  .object({
    width: z.number(),
    height: z.number(),
    widthPct: z.number(),
    heightPct: z.number(),
  })
  .nullable();

const TextBlockSchema = z.object({
  blockId: z.string(),
  shapeId: z.string(),
  paragraphIndex: z.number().int(),
  text: z.string(),
  fullShapeText: z.string(),
  position: PositionSchema,
  size: SizeSchema,
  zIndex: z.number().int(),
  placeholderType: z.string().nullable(),
  dominantFontSize: z.number().nullable(),
  dominantColor: z.string().nullable(),
  dominantFontFamily: z.string().nullable(),
  isBold: z.boolean(),
  isItalic: z.boolean(),
  hasBullet: z.boolean(),
  bulletChar: z.string().nullable(),
  indentLevel: z.number().int(),
  alignment: z.string().nullable(),
  charCount: z.number().int(),
  wordCount: z.number().int(),
  isShort: z.boolean(),
  isAllCaps: z.boolean(),
  hasNumber: z.boolean(),
  startsWithNumber: z.boolean(),
  hasQuoteMark: z.boolean(),
  isTopRegion: z.boolean(),
  isBottomRegion: z.boolean(),
  isCenterAligned: z.boolean(),
  isFullWidth: z.boolean(),
  role: z.string().nullable(),
  runs: z.array(TextRunSchema),
});

const BulletListComponentSchema = z.object({
  type: z.literal("bullet_list"),
  items: z.array(TextBlockSchema),
  itemCount: z.number().int(),
  maxItemChars: z.number().int(),
  indentLevels: z.array(z.number().int()),
  hasSubBullets: z.boolean(),
});

const StepGroupComponentSchema = z.object({
  type: z.literal("step_group"),
  steps: z.array(TextBlockSchema),
  stepCount: z.number().int(),
  maxStepChars: z.number().int(),
});

const CardGridComponentSchema = z.object({
  type: z.literal("card_grid"),
  cards: z.array(TextBlockSchema),
  columns: z.number().int(),
  rows: z.number().int(),
  cardCount: z.number().int(),
});

const StatGroupComponentSchema = z.object({
  type: z.literal("stat_group"),
  stats: z.array(
    z.object({
      label: TextBlockSchema.nullable(),
      value: TextBlockSchema,
    })
  ),
  statCount: z.number().int(),
});

const TwoColumnLayoutComponentSchema = z.object({
  type: z.literal("two_column_layout"),
  leftBlocks: z.array(TextBlockSchema),
  rightBlocks: z.array(TextBlockSchema),
  leftCharCount: z.number().int(),
  rightCharCount: z.number().int(),
});

const ComponentSchema = z.discriminatedUnion("type", [
  BulletListComponentSchema,
  StepGroupComponentSchema,
  CardGridComponentSchema,
  StatGroupComponentSchema,
  TwoColumnLayoutComponentSchema,
]);

const SlideConstraintsSchema = z.object({
  maxBullets: z.number().int().nullable(),
  maxCharsPerBullet: z.number().int().nullable(),
  maxTitleChars: z.number().int().nullable(),
  maxBodyChars: z.number().int().nullable(),
  columnCount: z.number().int(),
  overflowRisk: z.boolean(),
  recommendedLayout: z.string(),
});

const ContentModelSchema = z.object({
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  bullets: z.array(z.string()),
  body: z.array(z.string()),
  stats: z.array(z.string()),
  steps: z.array(z.string()),
});

const SlideOutputSchema = z.object({
  index: z.number().int(),
  slideType: z.string(),
  confidence: z.number(),
  signals: z.array(z.string()),
  layoutPattern: z.string(),
  grid: z.object({
    columns: z.number().int(),
    rows: z.number().int(),
  }),
  elements: z.array(TextBlockSchema),
  components: z.array(ComponentSchema),
  contentModel: ContentModelSchema,
  constraints: SlideConstraintsSchema,
});

const DesignTokensSchema = z.object({
  colors: z.object({
    palette: z.array(z.string()),
    primary: z.string().nullable(),
    secondary: z.string().nullable(),
    accent: z.string().nullable(),
    bodyText: z.string().nullable(),
    roles: z.object({
      primary: z.string().nullable(),
      secondary: z.string().nullable(),
      accent: z.string().nullable(),
      bodyText: z.string().nullable(),
    }),
  }),
  typography: z.object({
    allSizes: z.array(z.number()),
    scale: z.object({
      display: z.number().nullable(),
      h1: z.number().nullable(),
      h2: z.number().nullable(),
      body: z.number().nullable(),
      small: z.number().nullable(),
    }),
    fonts: z.array(z.string()),
    primaryFont: z.string().nullable(),
    sizeRatio: z.number().nullable(),
  }),
  spacing: z.object({
    xs: z.number(),
    sm: z.number(),
    md: z.number(),
    lg: z.number(),
    xl: z.number(),
  }),
});

const PresentationIntelligenceSchema = z.object({
  version: z.literal("2.0"),
  designSystem: DesignTokensSchema,
  slides: z.array(SlideOutputSchema),
  meta: z.object({
    totalSlides: z.number().int(),
    slideTypeBreakdown: z.record(z.string(), z.number().int()),
    llmFlaggedSlides: z.array(z.number().int()),
    processingNotes: z.array(z.string()),
  }),
});

function validateOutput(data) {
  return PresentationIntelligenceSchema.safeParse(data);
}

module.exports = {
  PresentationIntelligenceSchema,
  TextBlockSchema,
  ComponentSchema,
  SlideOutputSchema,
  validateOutput,
};
