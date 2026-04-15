/**
 * Master orchestrator: OOXML shapes → blocks → classify → components → design tokens (Phase 7).
 * @module intelligence/pipeline
 */

const { extractShapes } = require("../ooxml/shapeExtractor");
const { assembleBlocks, assembleSlideSummary } = require("./blockAssembler");
const { batchClassify, flagForLLM } = require("./slideClassifier");
const { detectComponents, getLayoutPattern } = require("./componentDetector");
const {
  extractDesignTokens,
  buildConstraints,
  assignSemanticRoles,
} = require("./designSystem");

const EMPTY_SUMMARY = {
  slideIndex: 0,
  blockCount: 0,
  bulletBlockCount: 0,
  shortBlockCount: 0,
  hasSequentialNumbers: false,
  numberDensity: 0,
  gridCandidate: false,
  dominantAlignment: null,
  totalCharCount: 0,
  blocks: [],
};

const FALLBACK_DESIGN_TOKENS = {
  colors: {
    palette: [],
    primary: null,
    secondary: null,
    accent: null,
    bodyText: null,
    roles: {
      primary: null,
      secondary: null,
      accent: null,
      bodyText: null,
    },
  },
  typography: {
    allSizes: [],
    scale: {
      display: null,
      h1: null,
      h2: null,
      body: null,
      small: null,
    },
    fonts: [],
    primaryFont: null,
    sizeRatio: null,
  },
  spacing: { xs: 9, sm: 25, md: 50, lg: 101, xl: 202 },
};

const FALLBACK_CONSTRAINTS = {
  maxBullets: null,
  maxCharsPerBullet: null,
  maxTitleChars: null,
  maxBodyChars: null,
  columnCount: 1,
  overflowRisk: false,
  recommendedLayout: "unknown",
};

function buildContentModel(blocksWithRoles) {
  const blocks = Array.isArray(blocksWithRoles) ? blocksWithRoles : [];
  return {
    title:
      (blocks.find((b) => b.role === "title") || null)?.text ?? null,
    subtitle:
      (blocks.find((b) => b.role === "subtitle") || null)?.text ?? null,
    bullets: blocks.filter((b) => b.role === "bullet").map((b) => b.text),
    body: blocks.filter((b) => b.role === "body").map((b) => b.text),
    stats: blocks.filter((b) => b.role === "stat").map((b) => b.text),
    steps: blocks.filter((b) => b.role === "step").map((b) => b.text),
  };
}

function inferGrid(components) {
  const comps = Array.isArray(components) ? components : [];
  const cardGrid = comps.find((c) => c.type === "card_grid");
  const twoCol = comps.find((c) => c.type === "two_column_layout");
  if (cardGrid) {
    return { columns: cardGrid.columns, rows: cardGrid.rows };
  }
  if (twoCol) {
    return { columns: 2, rows: 1 };
  }
  return { columns: 1, rows: 1 };
}

/**
 * @param {string} filePath
 * @returns {Promise<object>}
 */
async function runIntelligencePipeline(filePath) {
  try {
    const rawSlides = await extractShapes(filePath);

    const summaries = [];
    const processingNotes = [];

    for (const rawSlide of rawSlides) {
      try {
        const blocks = assembleBlocks(rawSlide.shapes);
        const summary = assembleSlideSummary(
          rawSlide.shapes,
          rawSlide.slideIndex
        );
        summary.blocks = blocks;
        summaries.push(summary);
      } catch (err) {
        processingNotes.push(
          `Slide ${rawSlide.slideIndex}: block assembly failed — ${err.message}`
        );
        summaries.push({
          ...EMPTY_SUMMARY,
          slideIndex: rawSlide.slideIndex,
        });
      }
    }

    const totalSlides = summaries.length;
    const classifications = batchClassify(summaries, totalSlides);

    const slideResults = [];

    for (let i = 0; i < summaries.length; i++) {
      const summary = summaries[i];
      const classification = classifications[i];

      let components = [];
      let layoutPattern = "unknown";
      let blocksWithRoles = summary.blocks;

      try {
        components = detectComponents(
          summary.blocks,
          classification.slideType
        );
        layoutPattern = getLayoutPattern(
          components,
          classification.slideType
        );
        blocksWithRoles = assignSemanticRoles(
          summary.blocks,
          classification.slideType
        );
      } catch (err) {
        processingNotes.push(
          `Slide ${summary.slideIndex}: component/role step failed — ${err.message}`
        );
      }

      slideResults.push({
        summary,
        classification,
        components,
        layoutPattern,
        blocksWithRoles,
      });
    }

    let designTokens;
    try {
      designTokens = extractDesignTokens(summaries);
    } catch (err) {
      processingNotes.push(`Design token extraction failed — ${err.message}`);
      designTokens = FALLBACK_DESIGN_TOKENS;
    }

    const llmFlaggedSlides = [];
    const slideTypeBreakdown = {};

    const slides = slideResults.map((result) => {
      const { summary, classification, components, layoutPattern, blocksWithRoles } =
        result;

      if (flagForLLM(classification)) {
        llmFlaggedSlides.push(summary.slideIndex);
      }

      const t = classification.slideType;
      slideTypeBreakdown[t] = (slideTypeBreakdown[t] ?? 0) + 1;

      let constraints;
      try {
        constraints = buildConstraints(summary, components);
      } catch (err) {
        processingNotes.push(
          `Slide ${summary.slideIndex}: constraint build failed — ${err.message}`
        );
        constraints = { ...FALLBACK_CONSTRAINTS };
      }

      return {
        index: summary.slideIndex,
        slideType: classification.slideType,
        confidence: classification.confidence,
        signals: classification.signals,
        layoutPattern,
        grid: inferGrid(components),
        elements: blocksWithRoles,
        components,
        contentModel: buildContentModel(blocksWithRoles),
        constraints,
      };
    });

    return {
      version: "2.0",
      designSystem: designTokens,
      slides,
      meta: {
        totalSlides,
        slideTypeBreakdown,
        llmFlaggedSlides,
        processingNotes,
      },
    };
  } catch (err) {
    throw new Error(`Intelligence pipeline failed: ${err.message}`);
  }
}

module.exports = { runIntelligencePipeline };

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node src/intelligence/pipeline.js <path-to.pptx>");
    process.exit(1);
  }

  const { validateOutput } = require("../schemas/presentationSchema");

  runIntelligencePipeline(filePath)
    .then((result) => {
      console.log("=== PIPELINE RESULT SUMMARY ===");
      console.log("Version:", result.version);
      console.log("Total slides:", result.meta.totalSlides);
      console.log("Slide type breakdown:", result.meta.slideTypeBreakdown);
      console.log("LLM flagged slides:", result.meta.llmFlaggedSlides);
      console.log("Processing notes:", result.meta.processingNotes);
      console.log(
        "Design system primary color:",
        result.designSystem.colors.primary
      );
      console.log("Typography scale:", result.designSystem.typography.scale);
      console.log("Primary font:", result.designSystem.typography.primaryFont);
      console.log("");
      result.slides.forEach((s) => {
        console.log(
          `Slide ${s.index}: [${s.slideType}] conf=${s.confidence} layout=${s.layoutPattern}`
        );
        console.log(`  title: ${s.contentModel.title ?? "(none)"}`);
        console.log(
          `  components: ${s.components.map((c) => c.type).join(", ") || "none"}`
        );
        console.log(`  elements: ${s.elements.length} blocks`);
        console.log(
          `  llmFlag: ${result.meta.llmFlaggedSlides.includes(s.index)}`
        );
      });

      const validation = validateOutput(result);
      console.log("\n=== SCHEMA VALIDATION ===");
      if (validation.success) {
        console.log("PASS — output matches PresentationIntelligenceSchema");
      } else {
        console.log("FAIL — schema issues:");
        validation.error.issues.forEach((issue) => {
          console.log(`  [${issue.path.join(".")}] ${issue.message}`);
        });
      }
    })
    .catch((err) => {
      console.error("Pipeline error:", err);
      process.exit(1);
    });
}
