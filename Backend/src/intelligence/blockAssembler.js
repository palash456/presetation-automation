/**
 * Assembles semantic TextBlocks and SlideSummary from extracted shapes (Phase 3).
 * Pure logic — no I/O, no XML.
 * @module intelligence/blockAssembler
 */

/**
 * @param {any[]} values
 * @returns {any|null}
 */
function mode(values) {
  const filtered = values.filter((v) => v != null);
  if (filtered.length === 0) return null;
  const counts = new Map();
  for (const v of filtered) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  const candidates = [...counts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([v]) => v);
  if (candidates.length === 1) return candidates[0];
  if (candidates.every((x) => typeof x === "number")) {
    return Math.max(...candidates);
  }
  let last = null;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (candidates.includes(filtered[i])) {
      last = filtered[i];
      break;
    }
  }
  return last;
}

function sortRunsByRunIndex(runs) {
  return [...runs].sort((a, b) => (a.runIndex ?? 0) - (b.runIndex ?? 0));
}

function buildParagraphText(runs) {
  return runs
    .filter((r) => r.text !== "\n")
    .map((r) => r.text)
    .join("");
}

function charWeightedFlag(runs, key) {
  let weighted = 0;
  let total = 0;
  for (const r of runs) {
    if (r.text === "\n") continue;
    const len = (r.text && r.text.length) || 0;
    total += len;
    if (r[key] === true) weighted += len;
  }
  if (total === 0) return false;
  return weighted / total > 0.5;
}

function hasQuoteMark(text) {
  return /[\u0022\u201C\u201D\u201E\u00AB\u00BB]/.test(text);
}

function computeSequentialNumbers(blocks) {
  const numbered = blocks.filter((b) => b.startsWithNumber);
  if (numbered.length < 3) return false;
  const nums = numbered
    .map((b) => {
      const m = b.text.match(/^\s*(\d+)/);
      return m ? parseInt(m[1], 10) : NaN;
    })
    .filter((n) => Number.isFinite(n));
  if (nums.length < 3) return false;
  const uniq = [...new Set(nums)].sort((a, b) => a - b);
  for (let i = 0; i <= uniq.length - 3; i++) {
    if (
      uniq[i + 1] === uniq[i] + 1 &&
      uniq[i + 2] === uniq[i] + 2
    ) {
      return true;
    }
  }
  return false;
}

function computeGridCandidate(blocks) {
  const sized = blocks.filter(
    (b) => b.size != null && typeof b.size.widthPct === "number"
  );
  if (sized.length < 3) return false;
  const widths = sized.map((b) => b.size.widthPct);
  const minW = Math.min(...widths);
  const maxW = Math.max(...widths);
  return maxW - minW < 0.15;
}

/**
 * @param {object[]} shapes
 * @returns {object[]}
 */
function assembleBlocks(shapes) {
  const blocks = [];

  for (const shape of shapes) {
    if (!shape.textRuns || shape.textRuns.length === 0) continue;

    const byPara = new Map();
    for (const run of shape.textRuns) {
      const pi = run.paragraphIndex ?? 0;
      if (!byPara.has(pi)) byPara.set(pi, []);
      byPara.get(pi).push(run);
    }

    const paraIndices = [...byPara.keys()].sort((a, b) => a - b);
    for (const paragraphIndex of paraIndices) {
      const runs = sortRunsByRunIndex(byPara.get(paragraphIndex));
      const text = buildParagraphText(runs);
      if (text === "") continue;

      const fontSizes = runs.map((r) => r.fontSize);
      const dominantFontSize = mode(fontSizes.filter((x) => x != null));

      const colorsForMode = runs
        .map((r) => r.color)
        .filter((c) => c != null && typeof c === "string" && !c.startsWith("theme:"));
      const dominantColor =
        colorsForMode.length > 0 ? mode(colorsForMode) : null;

      const families = runs.map((r) => r.fontFamily);
      const dominantFontFamily = mode(families.filter((x) => x != null && x !== ""));

      const first = runs[0];
      const pos = shape.position;
      const size = shape.size;

      let isTopRegion = false;
      let isBottomRegion = false;
      let isCenterAligned = false;
      let isFullWidth = false;
      if (pos != null && typeof pos.yPct === "number") {
        isTopRegion = pos.yPct < 0.25;
        isBottomRegion = pos.yPct > 0.72;
      }
      if (
        pos != null &&
        size != null &&
        typeof pos.xPct === "number" &&
        typeof size.widthPct === "number"
      ) {
        isCenterAligned =
          pos.xPct > 0.15 && pos.xPct + size.widthPct < 0.85;
      }
      if (size != null && typeof size.widthPct === "number") {
        isFullWidth = size.widthPct > 0.72;
      }

      const wordCount = text.split(/\s+/).filter(Boolean).length;

      blocks.push({
        blockId: `${shape.shapeId}-p${paragraphIndex}`,
        shapeId: shape.shapeId,
        paragraphIndex,
        text,
        fullShapeText: shape.fullText ?? "",
        position: shape.position ?? null,
        size: shape.size ?? null,
        zIndex: shape.zIndex ?? 0,
        placeholderType: shape.placeholderType ?? null,
        dominantFontSize,
        dominantColor,
        dominantFontFamily,
        isBold: charWeightedFlag(runs, "bold"),
        isItalic: charWeightedFlag(runs, "italic"),
        hasBullet: !!first.hasBullet,
        bulletChar: first.bulletChar ?? null,
        indentLevel: first.indentLevel ?? 0,
        alignment: first.alignment ?? null,
        charCount: text.length,
        wordCount,
        isShort: wordCount < 8,
        isAllCaps:
          text.length > 2 &&
          text === text.toUpperCase() &&
          /[A-Z]/.test(text),
        hasNumber: /\d/.test(text),
        startsWithNumber: /^\s*\d+[\.\)]\s/.test(text),
        hasQuoteMark: hasQuoteMark(text),
        isTopRegion,
        isBottomRegion,
        isCenterAligned,
        isFullWidth,
        role: null,
        runs,
      });
    }
  }

  blocks.sort((a, b) => {
    const z = (a.zIndex ?? 0) - (b.zIndex ?? 0);
    if (z !== 0) return z;
    return (a.paragraphIndex ?? 0) - (b.paragraphIndex ?? 0);
  });

  return blocks;
}

/**
 * @param {object[]} shapes
 * @param {number} slideIndex
 * @returns {object}
 */
function assembleSlideSummary(shapes, slideIndex) {
  const blocks = assembleBlocks(shapes);
  const blockCount = blocks.length;

  if (blockCount === 0) {
    return {
      slideIndex,
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
  }

  const bulletBlockCount = blocks.filter((b) => b.hasBullet).length;
  const shortBlockCount = blocks.filter((b) => b.isShort).length;
  const numberDensity =
    blocks.filter((b) => b.hasNumber).length / blockCount;

  const alignments = blocks.map((b) => b.alignment);
  const dominantAlignment = mode(alignments.filter((a) => a != null));

  const totalCharCount = blocks.reduce((s, b) => s + b.charCount, 0);

  return {
    slideIndex,
    blockCount,
    bulletBlockCount,
    shortBlockCount,
    hasSequentialNumbers: computeSequentialNumbers(blocks),
    numberDensity,
    gridCandidate: computeGridCandidate(blocks),
    dominantAlignment,
    totalCharCount,
    blocks,
  };
}

module.exports = {
  assembleBlocks,
  assembleSlideSummary,
};

if (require.main === module) {
  const { extractShapes } = require("../ooxml/shapeExtractor");
  const sample = process.argv[2];
  if (!sample) {
    console.error("Usage: node src/intelligence/blockAssembler.js <path-to.pptx>");
    process.exit(1);
  }
  extractShapes(sample)
    .then((slides) => {
      if (!slides || slides.length === 0) {
        console.error("No slides in file.");
        process.exit(1);
      }
      const summary = assembleSlideSummary(slides[0].shapes, slides[0].slideIndex);
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
