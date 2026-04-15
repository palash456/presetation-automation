const { OfficeParser } = require("officeparser");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { runIntelligencePipeline } = require("./intelligence/pipeline");
const { validateOutput } = require("./schemas/presentationSchema");

async function parsePPT(filePath) {
  logger.info("Starting PPT parse", { filePath });

  const ast = await OfficeParser.parseOffice(filePath, {
    extractAttachments: true,
    includeRawContent: false,
  });

  const stat = fs.statSync(filePath);

  const fonts = new Set();
  const colors = new Set();
  const backgroundColors = new Set();
  const fontSizes = new Set();
  const hyperlinks = [];
  const formatting = { bold: 0, italic: 0, underline: 0, strikethrough: 0, subscript: 0, superscript: 0 };
  const alignments = {};

  let imageCount = 0;
  let tableCount = 0;
  let chartCount = 0;
  let totalTextRuns = 0;

  const slides = [];

  if (ast.content && Array.isArray(ast.content)) {
    for (const node of ast.content) {
      if (node.type === "slide" || node.type === "section") {
        const slideData = processSlide(node, {
          fonts, colors, backgroundColors, fontSizes, hyperlinks,
          formatting, alignments,
        });
        imageCount += slideData.images;
        tableCount += slideData.tables;
        chartCount += slideData.charts;
        totalTextRuns += slideData.textRuns;
        slides.push(slideData.summary);
      }
    }
  }

  const attachmentSummary = (ast.attachments || []).map((a) => ({
    name: a.name,
    type: a.type,
    mimeType: a.mimeType,
    extension: a.extension,
    hasOcrText: !!a.ocrText,
  }));

  const metadata = {
    file: {
      name: path.basename(filePath),
      size: stat.size,
      sizeHuman: formatBytes(stat.size),
      extension: path.extname(filePath),
      lastModified: stat.mtime.toISOString(),
    },
    document: ast.metadata ?? {},
    presentation: {
      slideCount: slides.length,
      totalTextRuns,
      imageCount,
      tableCount,
      chartCount,
      attachmentCount: (ast.attachments || []).length,
    },
    typography: {
      fonts: [...fonts].sort(),
      fontSizes: [...fontSizes].sort(),
    },
    colors: {
      textColors: [...colors].sort(),
      backgroundColors: [...backgroundColors].sort(),
      uniqueColorCount: new Set([...colors, ...backgroundColors]).size,
    },
    textFormatting: {
      ...formatting,
      totalTextRuns,
    },
    alignments,
    hyperlinks,
    slides,
    attachments: attachmentSummary,
    textPreview: ast.toText().slice(0, 2000),
  };

  // --- Intelligence Pipeline (Phase 7) ---
  let intelligence = null;
  let intelligenceError = null;

  try {
    intelligence = await runIntelligencePipeline(filePath);

    const validation = validateOutput(intelligence);
    if (!validation.success) {
      logger.warn("Intelligence output failed schema validation", {
        errors: validation.error.issues.slice(0, 5),
      });
      intelligenceError = `Schema validation warning: ${validation.error.issues.length} issues`;
    }
  } catch (err) {
    logger.error("Intelligence pipeline failed", { error: err.message });
    intelligenceError = err.message;
    intelligence = null;
  }

  metadata.intelligence = intelligence;
  metadata.intelligenceError = intelligenceError;
  metadata.version = "2.0";
  // --- End Intelligence Pipeline ---

  logger.info("PPT parsed successfully", {
    filePath,
    slideCount: slides.length,
    fontCount: fonts.size,
    colorCount: colors.size,
  });

  return metadata;
}

function processSlide(slideNode, global) {
  const slideFonts = new Set();
  const slideColors = new Set();
  const slideFontSizes = new Set();
  const slideHyperlinks = [];
  let images = 0;
  let tables = 0;
  let charts = 0;
  let textRuns = 0;

  const slideNumber = slideNode.metadata?.slideNumber ?? null;

  function walk(node) {
    if (!node) return;

    if (node.type === "image") images++;
    if (node.type === "table") tables++;
    if (node.type === "chart") charts++;

    if (node.metadata?.alignment) {
      const a = node.metadata.alignment;
      global.alignments[a] = (global.alignments[a] || 0) + 1;
    }

    if (node.formatting) {
      textRuns++;
      const f = node.formatting;

      if (f.font) {
        slideFonts.add(f.font);
        global.fonts.add(f.font);
      }
      if (f.color) {
        slideColors.add(f.color);
        global.colors.add(f.color);
      }
      if (f.backgroundColor) {
        global.backgroundColors.add(f.backgroundColor);
      }
      if (f.size) {
        slideFontSizes.add(f.size);
        global.fontSizes.add(f.size);
      }
      if (f.bold) global.formatting.bold++;
      if (f.italic) global.formatting.italic++;
      if (f.underline) global.formatting.underline++;
      if (f.strikethrough) global.formatting.strikethrough++;
      if (f.subscript) global.formatting.subscript++;
      if (f.superscript) global.formatting.superscript++;
    }

    if (node.metadata?.link) {
      const link = {
        url: node.metadata.link,
        type: node.metadata.linkType,
        text: node.text || "",
        slide: slideNumber,
      };
      slideHyperlinks.push(link);
      global.hyperlinks.push(link);
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }

  if (slideNode.children) {
    for (const child of slideNode.children) walk(child);
  }

  const title = extractTitle(slideNode);

  return {
    images,
    tables,
    charts,
    textRuns,
    summary: {
      index: slideNumber,
      title,
      fonts: [...slideFonts].sort(),
      colors: [...slideColors].sort(),
      fontSizes: [...slideFontSizes].sort(),
      hyperlinks: slideHyperlinks,
      imageCount: images,
      tableCount: tables,
      chartCount: charts,
      textRunCount: textRuns,
      textLength: extractText(slideNode).length,
    },
  };
}

function extractTitle(node) {
  if (node.title) return node.title;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child.type === "heading" || child.type === "title") {
        return extractText(child);
      }
    }
    const firstText = extractText(node.children[0]);
    if (firstText) return firstText.slice(0, 100);
  }
  return "Untitled";
}

function extractText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.text) return node.text;
  if (node.value) return node.value;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractText).join(" ");
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractText).join(" ");
  }
  return "";
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = { parsePPT };
