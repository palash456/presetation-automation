/**
 * Design tokens, slide constraints, and semantic roles (Phase 6).
 * Pure logic — no I/O, no external dependencies.
 * @module intelligence/designSystem
 */

const { getLayoutPattern } = require("./componentDetector");

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

function hexToRgb(hex) {
  const h = hex.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  return 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
}

function saturation(hex) {
  const { r, g, b } = hexToRgb(hex);
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const s = (max - min) / (l > 0.5 ? 2 - max - min : max + min);
  return s;
}

function isLight(hex) {
  return luminance(hex) > 0.8;
}

function isNearBlack(hex) {
  return luminance(hex) < 0.1;
}

function inc(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function sortMapKeysByFrequencyDesc(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

function mostFrequentKey(map) {
  if (map.size === 0) return null;
  return sortMapKeysByFrequencyDesc(map)[0];
}

function mostFrequentKeyWhere(map, pred) {
  for (const k of sortMapKeysByFrequencyDesc(map)) {
    if (pred(k)) return k;
  }
  return null;
}

/**
 * @param {object[]} allSlideSummaries
 * @returns {object}
 */
function extractDesignTokens(allSlideSummaries) {
  const summaries = Array.isArray(allSlideSummaries) ? allSlideSummaries : [];

  const colorFrequency = new Map();
  const titleColorFrequency = new Map();
  const bodyColorFrequency = new Map();
  const sizesList = [];
  const fontOrder = [];
  const fontFrequency = new Map();
  const seenFonts = new Set();

  for (const sum of summaries) {
    const blocks = Array.isArray(sum.blocks) ? sum.blocks : [];
    for (const block of blocks) {
      const c = block.dominantColor;
      if (typeof c === "string" && !c.startsWith("theme:") && HEX6.test(c)) {
        inc(colorFrequency, c);
        if (block.placeholderType === "title" || block.isTopRegion === true) {
          inc(titleColorFrequency, c);
        }
        if (
          block.placeholderType === "body" ||
          block.role === "body"
        ) {
          inc(bodyColorFrequency, c);
        }
      }

      if (block.dominantFontSize != null && Number.isFinite(block.dominantFontSize)) {
        sizesList.push(block.dominantFontSize);
      }

      const fam = block.dominantFontFamily;
      if (fam != null && fam !== "") {
        inc(fontFrequency, fam);
        if (!seenFonts.has(fam)) {
          seenFonts.add(fam);
          fontOrder.push(fam);
        }
      }
    }
  }

  const allColors = sortMapKeysByFrequencyDesc(colorFrequency);
  const midColors = allColors.filter((c) => !isLight(c) && !isNearBlack(c));

  let primary = null;
  if (midColors.length === 0) {
    primary = null;
  } else if (titleColorFrequency.size > 0) {
    primary = mostFrequentKey(titleColorFrequency);
  } else {
    primary = mostFrequentKeyWhere(colorFrequency, (k) => midColors.includes(k));
  }

  let bodyText = mostFrequentKey(bodyColorFrequency);
  if (bodyText == null && midColors.length > 0) {
    bodyText = mostFrequentKeyWhere(
      colorFrequency,
      (k) => midColors.includes(k) && k !== primary
    );
  }
  if (bodyText == null) {
    bodyText = null;
  }

  const accent = mostFrequentKeyWhere(
    colorFrequency,
    (k) =>
      saturation(k) > 0.35 &&
      k !== primary &&
      k !== bodyText
  );

  const secondary = mostFrequentKeyWhere(
    colorFrequency,
    (k) =>
      midColors.includes(k) &&
      k !== primary &&
      k !== bodyText &&
      k !== accent
  );

  const palette = allColors.slice(0, 20);

  const allSizes = [...new Set(sizesList)].sort((a, b) => a - b);
  const n = allSizes.length;
  let scale;
  if (n === 0) {
    scale = {
      display: null,
      h1: null,
      h2: null,
      body: null,
      small: null,
    };
  } else {
    scale = {
      display: allSizes[n - 1],
      h1: allSizes[Math.max(0, n - 2)],
      h2: allSizes[Math.max(0, n - 3)],
      body: allSizes[Math.floor((n - 1) / 2)],
      small: allSizes[0],
    };
  }

  const primaryFont = mostFrequentKey(fontFrequency);

  let sizeRatio = null;
  if (
    scale.display != null &&
    scale.small != null &&
    scale.small > 0
  ) {
    sizeRatio = Math.round((scale.display / scale.small) * 100) / 100;
  }

  const baseSize = scale.body ?? 18;
  const leading = 1.4;

  const spacing = {
    xs: Math.round(baseSize * 0.5),
    sm: Math.round(baseSize * leading),
    md: Math.round(baseSize * leading * 2),
    lg: Math.round(baseSize * leading * 4),
    xl: Math.round(baseSize * leading * 8),
  };

  return {
    colors: {
      palette,
      primary,
      secondary,
      accent,
      bodyText,
      roles: {
        primary,
        secondary,
        accent,
        bodyText,
      },
    },
    typography: {
      allSizes,
      scale,
      fonts: fontOrder,
      primaryFont,
      sizeRatio,
    },
    spacing,
  };
}

/**
 * @param {object} slideSummary
 * @param {object[]} components
 * @returns {object}
 */
function buildConstraints(slideSummary, components) {
  const sum = slideSummary || {};
  const comps = Array.isArray(components) ? components : [];
  const blocks = Array.isArray(sum.blocks) ? sum.blocks : [];

  const bulletList = comps.find((c) => c.type === "bullet_list") ?? null;
  const stepGroup = comps.find((c) => c.type === "step_group") ?? null;
  const cardGrid = comps.find((c) => c.type === "card_grid") ?? null;

  let maxBullets = null;
  let maxCharsPerBullet = null;
  if (bulletList) {
    maxBullets = bulletList.itemCount;
    maxCharsPerBullet = bulletList.maxItemChars;
  } else if (stepGroup) {
    maxBullets = stepGroup.stepCount;
    maxCharsPerBullet = stepGroup.maxStepChars;
  }

  const titleBlock = blocks.find(
    (b) => b.placeholderType === "title" || b.isTopRegion === true
  );
  const maxTitleChars = titleBlock != null ? titleBlock.charCount : null;

  const bodyBlocks = blocks.filter(
    (b) =>
      b.placeholderType === "body" ||
      (!b.hasBullet && !b.isTopRegion && !b.isBottomRegion)
  );
  const maxBodyChars =
    bodyBlocks.length > 0
      ? Math.max(...bodyBlocks.map((b) => b.charCount ?? 0))
      : null;

  let columnCount = 1;
  if (cardGrid) {
    columnCount = cardGrid.columns;
  } else if (comps.some((c) => c.type === "two_column_layout")) {
    columnCount = 2;
  }

  const overflowRisk = (sum.totalCharCount ?? 0) > 600;

  const slideType = sum.slideType ?? "unknown";
  const recommendedLayout = getLayoutPattern(comps, slideType);

  return {
    maxBullets,
    maxCharsPerBullet,
    maxTitleChars,
    maxBodyChars,
    columnCount,
    overflowRisk,
    recommendedLayout,
  };
}

/**
 * @param {object[]} blocks
 * @param {string} slideType
 * @returns {object[]}
 */
function assignSemanticRoles(blocks, slideType) {
  void slideType;
  const safe = Array.isArray(blocks) ? blocks : [];

  const sizes = safe
    .map((b) => b.dominantFontSize)
    .filter((s) => s != null && Number.isFinite(s));
  const uniqueSizes = [...new Set(sizes)].sort((a, b) => b - a);
  const maxFontSize = uniqueSizes[0] ?? null;
  const secondSize = uniqueSizes[1] ?? null;

  return safe.map((block) => {
    const pt = block.placeholderType;
    let role = "body";

    if (pt === "title") {
      role = "title";
    } else if (pt === "subTitle") {
      role = "subtitle";
    } else if (pt === "body") {
      role = "body";
    } else if (
      block.dominantFontSize === maxFontSize &&
      block.isTopRegion === true
    ) {
      role = "title";
    } else if (
      block.dominantFontSize === secondSize &&
      block.isTopRegion === true
    ) {
      role = "subtitle";
    } else if (block.hasBullet === true) {
      role = "bullet";
    } else if (block.startsWithNumber === true) {
      role = "step";
    } else if (
      block.isShort === true &&
      block.hasNumber === true &&
      (block.charCount ?? 0) < 25
    ) {
      role = "stat";
    } else if (block.hasQuoteMark === true && !block.hasBullet) {
      role = "quote";
    } else if (
      block.isBottomRegion === true &&
      (block.charCount ?? 0) < 80
    ) {
      role = "footnote";
    } else {
      role = "body";
    }

    return { ...block, role };
  });
}

module.exports = {
  extractDesignTokens,
  buildConstraints,
  assignSemanticRoles,
};

if (require.main === module) {
  function makeBlock(overrides) {
    return {
      blockId: "b1",
      shapeId: "s1",
      paragraphIndex: 0,
      text: "",
      fullShapeText: "",
      position: null,
      size: null,
      zIndex: 0,
      placeholderType: null,
      dominantFontSize: null,
      dominantColor: null,
      dominantFontFamily: null,
      isBold: false,
      isItalic: false,
      hasBullet: false,
      bulletChar: null,
      indentLevel: 0,
      alignment: null,
      charCount: 0,
      wordCount: 0,
      isShort: true,
      isAllCaps: false,
      hasNumber: false,
      startsWithNumber: false,
      hasQuoteMark: false,
      isTopRegion: false,
      isBottomRegion: false,
      isCenterAligned: false,
      isFullWidth: false,
      role: null,
      runs: [],
      ...overrides,
    };
  }

  const { extractDesignTokens: edt, assignSemanticRoles: asr, buildConstraints: bc } =
    require("./designSystem");

  const summaries = [
    {
      slideIndex: 1,
      blockCount: 2,
      bulletBlockCount: 0,
      shortBlockCount: 1,
      hasSequentialNumbers: false,
      numberDensity: 0,
      gridCandidate: false,
      dominantAlignment: "center",
      totalCharCount: 60,
      blocks: [
        makeBlock({
          dominantColor: "#1A2B3C",
          dominantFontSize: 36,
          dominantFontFamily: "Inter",
          placeholderType: "title",
          isTopRegion: true,
          charCount: 20,
          text: "Big Title",
        }),
        makeBlock({
          dominantColor: "#444444",
          dominantFontSize: 18,
          dominantFontFamily: "Inter",
          placeholderType: "body",
          charCount: 40,
          text: "Some body text here for context",
        }),
      ],
    },
    {
      slideIndex: 2,
      blockCount: 2,
      bulletBlockCount: 2,
      shortBlockCount: 0,
      hasSequentialNumbers: false,
      numberDensity: 0,
      gridCandidate: false,
      dominantAlignment: "left",
      totalCharCount: 200,
      blocks: [
        makeBlock({
          dominantColor: "#1A2B3C",
          dominantFontSize: 24,
          dominantFontFamily: "Inter",
          isTopRegion: true,
          charCount: 30,
          text: "Section header",
        }),
        makeBlock({
          dominantColor: "#444444",
          dominantFontSize: 14,
          dominantFontFamily: "Inter",
          hasBullet: true,
          charCount: 170,
          text: "Bullet content here",
        }),
      ],
    },
    {
      slideIndex: 3,
      blockCount: 2,
      bulletBlockCount: 0,
      shortBlockCount: 2,
      hasSequentialNumbers: false,
      numberDensity: 1,
      gridCandidate: false,
      dominantAlignment: "center",
      totalCharCount: 30,
      blocks: [
        makeBlock({
          dominantColor: "#E63946",
          dominantFontSize: 36,
          dominantFontFamily: "Inter",
          hasNumber: true,
          isShort: true,
          charCount: 8,
          text: "$4.2M",
        }),
        makeBlock({
          dominantColor: "#444444",
          dominantFontSize: 14,
          dominantFontFamily: "Inter",
          charCount: 22,
          text: "Total Revenue Q4 2025",
        }),
      ],
    },
  ];

  console.log("Fixture 1 — extractDesignTokens:");
  const tokens = edt(summaries);
  console.log("  allSizes:", tokens.typography.allSizes);
  console.log("  primaryFont:", tokens.typography.primaryFont);
  console.log("  scale.display:", tokens.typography.scale.display);
  console.log("  scale.body:", tokens.typography.scale.body);
  console.log("  spacing.sm:", tokens.spacing.sm);
  console.log("  primary color set:", tokens.colors.primary !== null);
  console.log("  palette length:", tokens.colors.palette.length);

  console.log("\nFixture 2 — assignSemanticRoles:");
  const roleBlocks = [
    makeBlock({
      blockId: "b1",
      dominantFontSize: 36,
      isTopRegion: true,
      placeholderType: "title",
      text: "Title block",
      charCount: 11,
    }),
    makeBlock({
      blockId: "b2",
      dominantFontSize: 18,
      isTopRegion: true,
      text: "Subtitle here",
      charCount: 13,
    }),
    makeBlock({
      blockId: "b3",
      dominantFontSize: 14,
      hasBullet: true,
      text: "Bullet point",
      charCount: 12,
    }),
    makeBlock({
      blockId: "b4",
      dominantFontSize: 14,
      hasNumber: true,
      isShort: true,
      charCount: 8,
      text: "$1.2M",
    }),
    makeBlock({
      blockId: "b5",
      dominantFontSize: 12,
      isBottomRegion: true,
      charCount: 40,
      text: "Slide 3 of 10 — Confidential",
    }),
  ];
  const withRoles = asr(roleBlocks, "bullet");
  withRoles.forEach((b) => console.log(`  ${b.blockId}: ${b.role}`));

  console.log("\nFixture 3 — buildConstraints:");
  const mockSummary = {
    slideIndex: 2,
    blockCount: 5,
    bulletBlockCount: 4,
    shortBlockCount: 1,
    hasSequentialNumbers: false,
    numberDensity: 0.1,
    gridCandidate: false,
    dominantAlignment: "left",
    totalCharCount: 350,
    slideType: "bullet",
    blocks: [
      makeBlock({
        placeholderType: "title",
        isTopRegion: true,
        charCount: 28,
        text: "Title text here is this long",
      }),
      makeBlock({
        hasBullet: true,
        charCount: 80,
        text: "First bullet item with some content",
      }),
      makeBlock({
        hasBullet: true,
        charCount: 90,
        text: "Second bullet item with more content",
      }),
      makeBlock({
        hasBullet: true,
        charCount: 70,
        text: "Third bullet item shorter",
      }),
      makeBlock({
        hasBullet: true,
        charCount: 82,
        text: "Fourth bullet item medium",
      }),
    ],
  };
  const mockComponents = [
    {
      type: "bullet_list",
      items: mockSummary.blocks.slice(1),
      itemCount: 4,
      maxItemChars: 90,
      indentLevels: [0],
      hasSubBullets: false,
    },
  ];
  const constraints = bc(mockSummary, mockComponents);
  console.log("  maxBullets:", constraints.maxBullets);
  console.log("  maxCharsPerBullet:", constraints.maxCharsPerBullet);
  console.log("  maxTitleChars:", constraints.maxTitleChars);
  console.log("  columnCount:", constraints.columnCount);
  console.log("  overflowRisk:", constraints.overflowRisk);
  console.log("  recommendedLayout:", constraints.recommendedLayout);
}
