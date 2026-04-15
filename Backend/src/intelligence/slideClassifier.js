/**
 * Slide type classification from SlideSummary (Phase 4).
 * Pure logic — no I/O, no external dependencies.
 * @module intelligence/slideClassifier
 */

/** First entry wins on equal confidence */
const TYPE_TIE_PRIORITY = [
  "title",
  "thankyou",
  "process",
  "bullet",
  "stats",
  "matrix",
  "testimonial",
  "intro",
  "insight",
  "problem",
  "unknown",
];

function typeTieRank(t) {
  const i = TYPE_TIE_PRIORITY.indexOf(t);
  return i === -1 ? TYPE_TIE_PRIORITY.length : i;
}

/** @returns {boolean} true if a should win over b on tie */
function typeWinsTie(a, b) {
  return typeTieRank(a) < typeTieRank(b);
}

function pickWinner(candidates) {
  let winner = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.confidence > winner.confidence) {
      winner = c;
    } else if (c.confidence === winner.confidence && typeWinsTie(c.type, winner.type)) {
      winner = c;
    }
  }
  return winner;
}

/**
 * @param {object} summary SlideSummary
 * @param {number} slideIndex 1-based
 * @param {number} totalSlides
 * @returns {{ slideType: string, confidence: number, signals: string[] }}
 */
function classifySlide(summary, slideIndex, totalSlides) {
  const {
    blockCount,
    bulletBlockCount,
    shortBlockCount,
    hasSequentialNumbers,
    numberDensity,
    gridCandidate,
    dominantAlignment: _dominantAlignment,
    totalCharCount,
    blocks,
  } = summary;

  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const isFirst = slideIndex === 1;
  const isLast = slideIndex === totalSlides;

  const bulletRatio = blockCount > 0 ? bulletBlockCount / blockCount : 0;
  const shortRatio = blockCount > 0 ? shortBlockCount / blockCount : 0;

  const hasTitlePlaceholder = safeBlocks.some((b) => b.placeholderType === "title");
  const hasBodyPlaceholder = safeBlocks.some(
    (b) => b.placeholderType === "body" || b.placeholderType === "subTitle"
  );
  void hasBodyPlaceholder;

  const quoteBlockCount = safeBlocks.filter((b) => b.hasQuoteMark).length;

  const arrowBlockCount = safeBlocks.filter(
    (b) => /[→►▶➔➜]/.test(b.text || "") || /step\s*\d/i.test(b.text || "")
  ).length;

  const hasEndKeyword = safeBlocks.some((b) =>
    /thank|q\s*&\s*a|questions?|fin\b|the end|see you/i.test(b.text || "")
  );

  const statBlockCount = safeBlocks.filter(
    (b) => b.hasNumber && b.isShort && b.charCount < 25
  ).length;

  const candidates = [];

  // Rule 1 — title
  if (isFirst && blockCount <= 3 && hasTitlePlaceholder) {
    candidates.push({ type: "title", confidence: 0.95, signal: "title_slide_placeholder" });
  } else if (isFirst && blockCount <= 3) {
    candidates.push({ type: "title", confidence: 0.85, signal: "title_slide_position" });
  } else if (isFirst && blockCount <= 5) {
    candidates.push({ type: "title", confidence: 0.75, signal: "title_slide_first" });
  }

  // Rule 2 — thankyou
  if (isLast && hasEndKeyword && blockCount <= 4) {
    candidates.push({ type: "thankyou", confidence: 0.95, signal: "thankyou_keyword_last" });
  } else if (isLast && blockCount <= 2) {
    candidates.push({ type: "thankyou", confidence: 0.8, signal: "thankyou_last_sparse" });
  }

  // Rule 3 — bullet
  if (bulletRatio >= 0.5 && blockCount >= 3) {
    candidates.push({ type: "bullet", confidence: 0.9, signal: "bullet_ratio_high" });
  } else if (bulletBlockCount >= 3 && bulletRatio >= 0.3) {
    candidates.push({ type: "bullet", confidence: 0.78, signal: "bullet_count_moderate" });
  }

  // Rule 4 — process
  if (hasSequentialNumbers && blockCount >= 3) {
    candidates.push({ type: "process", confidence: 0.92, signal: "sequential_numbers" });
  } else if (arrowBlockCount >= 3) {
    candidates.push({ type: "process", confidence: 0.82, signal: "arrow_pattern" });
  } else if (arrowBlockCount >= 2 && hasSequentialNumbers) {
    candidates.push({ type: "process", confidence: 0.88, signal: "arrow_plus_numbers" });
  }

  // Rule 5 — stats
  if (statBlockCount >= 3 && shortRatio >= 0.5) {
    candidates.push({ type: "stats", confidence: 0.9, signal: "stat_blocks_high" });
  } else if (numberDensity >= 0.5 && shortRatio >= 0.5) {
    candidates.push({ type: "stats", confidence: 0.82, signal: "number_density_high" });
  }

  // Rule 6 — matrix
  if (gridCandidate && blockCount >= 6) {
    candidates.push({ type: "matrix", confidence: 0.88, signal: "grid_dense" });
  } else if (gridCandidate && blockCount >= 4) {
    candidates.push({ type: "matrix", confidence: 0.78, signal: "grid_sparse" });
  }

  // Rule 7 — testimonial
  if (quoteBlockCount >= 1 && blockCount <= 5 && bulletBlockCount === 0) {
    candidates.push({ type: "testimonial", confidence: 0.88, signal: "quote_present" });
  } else if (quoteBlockCount >= 2) {
    candidates.push({ type: "testimonial", confidence: 0.82, signal: "multiple_quotes" });
  }

  // Rule 8 — intro
  if (!isFirst && blockCount <= 2 && totalCharCount < 150) {
    candidates.push({ type: "intro", confidence: 0.8, signal: "sparse_non_first" });
  } else if (!isFirst && blockCount <= 3 && totalCharCount < 100) {
    candidates.push({ type: "intro", confidence: 0.75, signal: "very_sparse_non_first" });
  }

  // Rule 9 — insight
  if (
    !isFirst &&
    blockCount <= 4 &&
    bulletBlockCount === 0 &&
    totalCharCount > 80 &&
    totalCharCount < 400 &&
    quoteBlockCount === 0 &&
    statBlockCount === 0
  ) {
    candidates.push({ type: "insight", confidence: 0.52, signal: "insight_heuristic" });
  }

  // Rule 10 — problem
  if (
    !isFirst &&
    blockCount <= 5 &&
    bulletBlockCount === 0 &&
    totalCharCount > 100 &&
    safeBlocks.some((b) =>
      /problem|challenge|issue|pain|gap|broken|fail/i.test(b.text || "")
    )
  ) {
    candidates.push({ type: "problem", confidence: 0.6, signal: "problem_keyword" });
  }

  // Rule 11 — bullet fallback
  if (
    bulletBlockCount >= 2 &&
    !candidates.some((cand) => cand.type === "bullet")
  ) {
    candidates.push({ type: "bullet", confidence: 0.65, signal: "bullet_fallback" });
  }

  const signals = candidates.map((c) => c.signal);

  if (candidates.length === 0) {
    return {
      slideType: "unknown",
      confidence: 0,
      signals: ["no_rules_fired"],
    };
  }

  const winner = pickWinner(candidates);
  let slideType = winner.type;
  if (winner.confidence < 0.75) {
    slideType = "unknown";
  }

  const confidence = Math.round(winner.confidence * 100) / 100;

  return {
    slideType,
    confidence,
    signals,
  };
}

/**
 * @param {object[]} summaries ordered by slideIndex
 * @param {number} totalSlides
 * @returns {object[]}
 */
function batchClassify(summaries, totalSlides) {
  return summaries.map((s) => classifySlide(s, s.slideIndex, totalSlides));
}

/**
 * @param {object} classification
 * @returns {boolean}
 */
function flagForLLM(classification) {
  if (!classification) return true;
  const { confidence, slideType } = classification;
  if (confidence < 0.75) return true;
  if (slideType === "unknown") return true;
  if (slideType === "insight") return true;
  if (slideType === "problem") return true;
  return false;
}

module.exports = {
  classifySlide,
  batchClassify,
  flagForLLM,
};

if (require.main === module) {
  const block = (over) => ({
    placeholderType: null,
    hasBullet: false,
    hasNumber: false,
    isShort: true,
    hasQuoteMark: false,
    text: "",
    charCount: 0,
    wordCount: 0,
    startsWithNumber: false,
    ...over,
  });

  const f1 = {
    slideIndex: 1,
    blockCount: 2,
    bulletBlockCount: 0,
    shortBlockCount: 2,
    hasSequentialNumbers: false,
    numberDensity: 0,
    gridCandidate: false,
    dominantAlignment: "center",
    totalCharCount: 45,
    blocks: [
      block({
        placeholderType: "title",
        text: "Our Company",
        charCount: 11,
        wordCount: 2,
      }),
      block({
        text: "Subtitle here",
        charCount: 13,
        wordCount: 2,
      }),
    ],
  };

  const f2 = {
    slideIndex: 3,
    blockCount: 5,
    bulletBlockCount: 4,
    shortBlockCount: 2,
    hasSequentialNumbers: false,
    numberDensity: 0.1,
    gridCandidate: false,
    dominantAlignment: "left",
    totalCharCount: 320,
    blocks: [
      block({ hasBullet: true, text: "A", charCount: 1 }),
      block({ hasBullet: true, text: "B", charCount: 1 }),
      block({ hasBullet: true, text: "C", charCount: 1 }),
      block({ hasBullet: true, text: "D", charCount: 1 }),
      block({ hasBullet: false, text: "Note", charCount: 4 }),
    ],
  };

  const f3 = {
    slideIndex: 4,
    blockCount: 4,
    bulletBlockCount: 0,
    hasSequentialNumbers: true,
    numberDensity: 0.5,
    gridCandidate: false,
    shortBlockCount: 3,
    dominantAlignment: "left",
    totalCharCount: 180,
    blocks: [
      block({
        startsWithNumber: true,
        text: "1. Define",
        charCount: 9,
        hasNumber: true,
      }),
      block({
        startsWithNumber: true,
        text: "2. Build",
        charCount: 8,
        hasNumber: true,
      }),
      block({
        startsWithNumber: true,
        text: "3. Ship",
        charCount: 7,
        hasNumber: true,
      }),
      block({ text: "Footer", charCount: 6 }),
    ],
  };

  const f4 = {
    slideIndex: 6,
    blockCount: 3,
    bulletBlockCount: 0,
    hasSequentialNumbers: false,
    numberDensity: 0,
    gridCandidate: false,
    shortBlockCount: 0,
    dominantAlignment: "center",
    totalCharCount: 210,
    blocks: [
      block({
        isShort: false,
        text: "Lorem ipsum dolor sit amet with neutral prose here.",
        charCount: 70,
        wordCount: 10,
      }),
      block({
        isShort: false,
        text: "Second paragraph without digits or special patterns today.",
        charCount: 70,
        wordCount: 9,
      }),
      block({
        isShort: false,
        text: "Third block keeps the slide in the mid length range only.",
        charCount: 70,
        wordCount: 10,
      }),
    ],
  };

  const tests = [
    {
      name: "Fixture 1 title",
      summary: f1,
      slideIndex: 1,
      totalSlides: 10,
      expectType: "title",
      minConfidence: 0.85,
      checkFlag: null,
    },
    {
      name: "Fixture 2 bullet",
      summary: f2,
      slideIndex: 3,
      totalSlides: 10,
      expectType: "bullet",
      minConfidence: 0.85,
      checkFlag: null,
    },
    {
      name: "Fixture 3 process",
      summary: f3,
      slideIndex: 4,
      totalSlides: 10,
      expectType: "process",
      minConfidence: 0.9,
      checkFlag: null,
    },
    {
      name: "Fixture 4 LLM flag",
      summary: f4,
      slideIndex: 6,
      totalSlides: 10,
      expectType: null,
      minConfidence: null,
      checkFlag: true,
    },
  ];

  for (const t of tests) {
    const r = classifySlide(t.summary, t.slideIndex, t.totalSlides);
    let pass = true;
    const parts = [];
    if (t.expectType != null) {
      const ok = r.slideType === t.expectType && r.confidence >= t.minConfidence;
      pass = pass && ok;
      parts.push(
        `slideType: expected "${t.expectType}" & conf>=${t.minConfidence}, got "${r.slideType}" & ${r.confidence}`
      );
    }
    if (t.checkFlag != null) {
      const f = flagForLLM(r);
      const ok = f === t.checkFlag;
      pass = pass && ok;
      parts.push(`flagForLLM: expected ${t.checkFlag}, got ${f}`);
    }
    console.log(`${pass ? "PASS" : "FAIL"} — ${t.name}`);
    if (!pass) {
      parts.forEach((p) => console.log(`  ${p}`));
    }
    console.log(`  actual: ${JSON.stringify(r)}`);
  }
}
