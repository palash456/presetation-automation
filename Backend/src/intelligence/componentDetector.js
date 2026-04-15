/**
 * Detects structural components (bullet lists, steps, grids, stats, columns).
 * Pure logic — no I/O, no external dependencies.
 * @module intelligence/componentDetector
 */

function longestConsecutiveRuns(sortedUniq) {
  if (sortedUniq.length === 0) return [];
  const runs = [];
  let cur = [sortedUniq[0]];
  for (let i = 1; i < sortedUniq.length; i++) {
    if (sortedUniq[i] === sortedUniq[i - 1] + 1) {
      cur.push(sortedUniq[i]);
    } else {
      if (cur.length >= 3) runs.push([...cur]);
      cur = [sortedUniq[i]];
    }
  }
  if (cur.length >= 3) runs.push(cur);
  return runs;
}

function detectStepGroup(blocks) {
  const numbered = blocks.filter((b) => b.startsWithNumber === true);
  const withNum = [];
  for (const b of numbered) {
    const m = b.text.match(/^\s*(\d+)/);
    const n = m ? parseInt(m[1], 10) : NaN;
    if (Number.isFinite(n)) withNum.push({ block: b, n });
  }
  if (withNum.length === 0) return null;

  const uniq = [...new Set(withNum.map((x) => x.n))].sort((a, b) => a - b);
  const runs = longestConsecutiveRuns(uniq);
  if (runs.length === 0) return null;
  const best = runs.reduce((a, b) => (b.length > a.length ? b : a));
  if (best.length < 3) return null;

  const inRun = new Set(best);
  const steps = withNum
    .filter((x) => inRun.has(x.n))
    .sort((a, b) => a.n - b.n || blocks.indexOf(a.block) - blocks.indexOf(b.block))
    .map((x) => x.block);

  const charCounts = steps.map((b) => b.charCount ?? 0);
  return {
    type: "step_group",
    steps,
    stepCount: steps.length,
    maxStepChars: charCounts.length ? Math.max(...charCounts) : 0,
  };
}

function detectBulletList(blocks) {
  const items = blocks.filter((b) => b.hasBullet === true);
  if (items.length < 3) return null;
  const indentLevels = [...new Set(items.map((b) => b.indentLevel ?? 0))].sort(
    (a, b) => a - b
  );
  const charCounts = items.map((b) => b.charCount ?? 0);
  return {
    type: "bullet_list",
    items,
    itemCount: items.length,
    maxItemChars: Math.max(...charCounts),
    indentLevels,
    hasSubBullets: indentLevels.some((l) => l > 0),
  };
}

function detectCardGrid(blocks) {
  const candidates = blocks.filter((b) => b.size != null);
  if (candidates.length < 3) return null;

  const widthPcts = candidates.map((b) => b.size.widthPct);
  if (Math.max(...widthPcts) - Math.min(...widthPcts) >= 0.15) return null;

  const charCounts = candidates.map((b) => b.charCount ?? 0);
  const mean =
    charCounts.reduce((s, c) => s + c, 0) / Math.max(candidates.length, 1);
  const maxC = Math.max(...charCounts);
  if (maxC / Math.max(mean, 1) > 1.8) return null;

  if (candidates.some((b) => b.hasBullet === true)) return null;

  let columns;
  let rows;
  const allPos = candidates.every((b) => b.position != null);
  if (allPos) {
    const bucketCounts = new Map();
    for (const b of candidates) {
      const y = b.position.yPct;
      const bucket = Math.round(y / 0.08) * 0.08;
      bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
    }
    rows = bucketCounts.size;
    columns = Math.max(...bucketCounts.values());
  } else {
    columns = Math.ceil(Math.sqrt(candidates.length));
    rows = Math.ceil(candidates.length / columns);
  }

  return {
    type: "card_grid",
    cards: candidates,
    columns,
    rows,
    cardCount: candidates.length,
  };
}

function isValueBlock(b) {
  return b.hasNumber === true && b.isShort === true && b.charCount < 25;
}

function isLabelCandidate(b) {
  return (
    b.isShort === true &&
    b.hasNumber !== true &&
    (b.charCount ?? 0) < 40
  );
}

function detectStatGroup(blocks) {
  const usedLabelIds = new Set();
  const pairsA = [];

  for (let i = 0; i < blocks.length; i++) {
    const v = blocks[i];
    if (!isValueBlock(v)) continue;
    let label = null;
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= blocks.length) continue;
      const cand = blocks[j];
      if (usedLabelIds.has(cand.blockId)) continue;
      if (isLabelCandidate(cand)) {
        label = cand;
        usedLabelIds.add(cand.blockId);
        break;
      }
    }
    if (label != null) {
      pairsA.push({ label, value: v });
    }
  }

  if (pairsA.length >= 2) {
    return {
      type: "stat_group",
      stats: pairsA,
      statCount: pairsA.length,
    };
  }

  const standalone = blocks.filter(isValueBlock);
  if (standalone.length >= 3) {
    return {
      type: "stat_group",
      stats: standalone.map((value) => ({ label: null, value })),
      statCount: standalone.length,
    };
  }

  return null;
}

function detectTwoColumnLayout(blocks, slideType) {
  if (slideType === "bullet" || slideType === "process") return null;

  const candidates = blocks.filter((b) => b.position != null);
  if (candidates.length < 4) return null;

  const leftBlocks = candidates.filter((b) => b.position.xPct < 0.45);
  const rightBlocks = candidates.filter((b) => b.position.xPct > 0.55);

  if (leftBlocks.length < 2 || rightBlocks.length < 2) return null;

  const leftCharCount = leftBlocks.reduce((s, b) => s + (b.charCount ?? 0), 0);
  const rightCharCount = rightBlocks.reduce((s, b) => s + (b.charCount ?? 0), 0);

  return {
    type: "two_column_layout",
    leftBlocks,
    rightBlocks,
    leftCharCount,
    rightCharCount,
  };
}

/**
 * @param {object[]} blocks TextBlock[] in zIndex / paragraphIndex order
 * @param {string} slideType
 * @returns {object[]}
 */
function detectComponents(blocks, slideType) {
  const safe = Array.isArray(blocks) ? blocks : [];
  const components = [];
  let suppressBulletList = false;
  let suppressCardGrid = false;

  const step = detectStepGroup(safe);
  if (step) {
    components.push(step);
    suppressBulletList = true;
  }

  if (!suppressBulletList) {
    const bl = detectBulletList(safe);
    if (bl) {
      components.push(bl);
      suppressCardGrid = true;
    }
  }

  const stat = detectStatGroup(safe);
  if (stat) components.push(stat);

  if (!suppressCardGrid) {
    const cg = detectCardGrid(safe);
    if (cg) components.push(cg);
  }

  const tc = detectTwoColumnLayout(safe, slideType);
  if (tc) components.push(tc);

  return components;
}

/**
 * @param {object[]} components
 * @param {string} slideType
 * @returns {string}
 */
function getLayoutPattern(components, slideType) {
  const c = Array.isArray(components) ? components : [];
  const st = slideType || "";

  if (c.length === 0 && ["title", "intro", "thankyou"].includes(st)) {
    return "centered";
  }
  if (c.some((x) => x.type === "two_column_layout")) {
    return "two_column";
  }
  if (
    c.some((x) => x.type === "card_grid") &&
    !c.some((x) => x.type === "two_column_layout")
  ) {
    return "grid";
  }
  if (
    c.some((x) => x.type === "stat_group") &&
    !c.some((x) => x.type === "bullet_list") &&
    !c.some((x) => x.type === "step_group") &&
    !c.some((x) => x.type === "card_grid")
  ) {
    return "stat_layout";
  }
  if (
    c.length === 1 &&
    ["bullet_list", "step_group"].includes(c[0].type)
  ) {
    return "single_column";
  }
  if (c.length >= 2) {
    return "mixed";
  }
  return "unknown";
}

module.exports = {
  detectComponents,
  getLayoutPattern,
};

if (require.main === module) {
  function makeBlock(overrides) {
    return {
      blockId: "s1-p0",
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

  function ok(cond, msg) {
    if (!cond) console.log(`  FAIL: ${msg}`);
    return cond;
  }

  // Fixture 1 — bullet_list
  const f1 = [
    makeBlock({ blockId: "b0", hasBullet: true, indentLevel: 0, charCount: 5 }),
    makeBlock({ blockId: "b1", hasBullet: true, indentLevel: 0, charCount: 6 }),
    makeBlock({ blockId: "b2", hasBullet: true, indentLevel: 0, charCount: 4 }),
    makeBlock({ blockId: "b3", hasBullet: true, indentLevel: 1, charCount: 8 }),
    makeBlock({ blockId: "b4", hasBullet: true, indentLevel: 0, charCount: 3 }),
  ];
  const comp1 = detectComponents(f1, "bullet");
  const bl1 = comp1.find((x) => x.type === "bullet_list");
  const pass1 =
    ok(!!bl1, "bullet_list missing") &&
    ok(bl1.itemCount === 5, `itemCount ${bl1 && bl1.itemCount}`) &&
    ok(bl1.hasSubBullets === true, "hasSubBullets");

  console.log(`${pass1 ? "PASS" : "FAIL"} — Fixture 1 bullet_list`);
  console.log(`  actual:`, JSON.stringify(bl1, null, 2));

  // Fixture 2 — step_group, no bullet_list
  const f2 = [
    makeBlock({
      blockId: "s0",
      text: "1. Define scope",
      startsWithNumber: true,
      charCount: 16,
    }),
    makeBlock({
      blockId: "s1",
      text: "2. Build prototype",
      startsWithNumber: true,
      charCount: 18,
    }),
    makeBlock({
      blockId: "s2",
      text: "3. Test",
      startsWithNumber: true,
      charCount: 7,
    }),
    makeBlock({
      blockId: "s3",
      text: "4. Ship",
      startsWithNumber: true,
      charCount: 7,
    }),
  ];
  const comp2 = detectComponents(f2, "insight");
  const sg2 = comp2.find((x) => x.type === "step_group");
  const pass2 =
    ok(!!sg2, "step_group missing") &&
    ok(sg2.stepCount === 4, `stepCount ${sg2 && sg2.stepCount}`) &&
    ok(!comp2.some((x) => x.type === "bullet_list"), "bullet_list should be suppressed");

  console.log(`${pass2 ? "PASS" : "FAIL"} — Fixture 2 step_group`);
  console.log(`  actual:`, JSON.stringify(sg2, null, 2));

  // Fixture 3 — card_grid
  const f3 = [
    makeBlock({
      blockId: "c0",
      size: { widthPct: 0.22, heightPct: 0.3, width: 100, height: 80 },
      position: { xPct: 0.05, yPct: 0.4 },
      charCount: 60,
      hasBullet: false,
    }),
    makeBlock({
      blockId: "c1",
      size: { widthPct: 0.22, heightPct: 0.3, width: 100, height: 80 },
      position: { xPct: 0.3, yPct: 0.4 },
      charCount: 60,
      hasBullet: false,
    }),
    makeBlock({
      blockId: "c2",
      size: { widthPct: 0.22, heightPct: 0.3, width: 100, height: 80 },
      position: { xPct: 0.55, yPct: 0.4 },
      charCount: 60,
      hasBullet: false,
    }),
    makeBlock({
      blockId: "c3",
      size: { widthPct: 0.22, heightPct: 0.3, width: 100, height: 80 },
      position: { xPct: 0.8, yPct: 0.4 },
      charCount: 60,
      hasBullet: false,
    }),
  ];
  const comp3 = detectComponents(f3, "insight");
  const cg3 = comp3.find((x) => x.type === "card_grid");
  const pass3 =
    ok(!!cg3, "card_grid missing") &&
    ok(cg3.columns === 4, `columns ${cg3 && cg3.columns}`) &&
    ok(cg3.rows === 1, `rows ${cg3 && cg3.rows}`);

  console.log(`${pass3 ? "PASS" : "FAIL"} — Fixture 3 card_grid`);
  console.log(`  actual:`, JSON.stringify(cg3, null, 2));

  // Fixture 4 — stat_group paired
  const f4 = [
    makeBlock({
      blockId: "v0",
      text: "$4.2M",
      hasNumber: true,
      isShort: true,
      charCount: 8,
    }),
    makeBlock({
      blockId: "l0",
      text: "Revenue",
      hasNumber: false,
      isShort: true,
      charCount: 12,
    }),
    makeBlock({
      blockId: "v1",
      text: "87%",
      hasNumber: true,
      isShort: true,
      charCount: 8,
    }),
    makeBlock({
      blockId: "l1",
      text: "NPS",
      hasNumber: false,
      isShort: true,
      charCount: 12,
    }),
    makeBlock({
      blockId: "v2",
      text: "320",
      hasNumber: true,
      isShort: true,
      charCount: 8,
    }),
    makeBlock({
      blockId: "l2",
      text: "Users",
      hasNumber: false,
      isShort: true,
      charCount: 12,
    }),
  ];
  const comp4 = detectComponents(f4, "stats");
  const st4 = comp4.find((x) => x.type === "stat_group");
  const pass4 =
    ok(!!st4, "stat_group missing") &&
    ok(st4.statCount >= 2, `statCount ${st4 && st4.statCount}`);

  console.log(`${pass4 ? "PASS" : "FAIL"} — Fixture 4 stat_group`);
  console.log(`  actual:`, JSON.stringify(st4, null, 2));

  // Fixture 5 — two_column_layout
  const f5 = [
    makeBlock({ blockId: "L0", position: { xPct: 0.05, yPct: 0.1 }, charCount: 10 }),
    makeBlock({ blockId: "L1", position: { xPct: 0.1, yPct: 0.2 }, charCount: 10 }),
    makeBlock({ blockId: "L2", position: { xPct: 0.08, yPct: 0.3 }, charCount: 10 }),
    makeBlock({ blockId: "R0", position: { xPct: 0.58, yPct: 0.1 }, charCount: 10 }),
    makeBlock({ blockId: "R1", position: { xPct: 0.62, yPct: 0.2 }, charCount: 10 }),
    makeBlock({ blockId: "R2", position: { xPct: 0.6, yPct: 0.3 }, charCount: 10 }),
  ];
  const comp5 = detectComponents(f5, "insight");
  const tc5 = comp5.find((x) => x.type === "two_column_layout");
  const pass5 = ok(!!tc5, "two_column_layout missing");

  console.log(`${pass5 ? "PASS" : "FAIL"} — Fixture 5 two_column`);
  console.log(`  actual:`, JSON.stringify(tc5, null, 2));

  // getLayoutPattern tests
  const lp1 = getLayoutPattern([], "title");
  const lpPass1 = ok(lp1 === "centered", `[]+title → ${lp1}`);

  const blComp = {
    type: "bullet_list",
    items: [],
    itemCount: 3,
    maxItemChars: 1,
    indentLevels: [0],
    hasSubBullets: false,
  };
  const lp2 = getLayoutPattern([blComp], "bullet");
  const lpPass2 = ok(lp2 === "single_column", `bullet_list → ${lp2}`);

  const cgComp = {
    type: "card_grid",
    cards: [],
    columns: 2,
    rows: 2,
    cardCount: 4,
  };
  const lp3 = getLayoutPattern([cgComp], "insight");
  const lpPass3 = ok(lp3 === "grid", `card_grid → ${lp3}`);

  console.log(
    `${lpPass1 && lpPass2 && lpPass3 ? "PASS" : "FAIL"} — getLayoutPattern spot checks`
  );
  console.log(`  centered: ${lp1}, single_column: ${lp2}, grid: ${lp3}`);
}
