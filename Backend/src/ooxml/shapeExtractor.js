/**
 * OOXML shape geometry extraction from .pptx (ZIP) without officeparser.
 * @module ooxml/shapeExtractor
 */

const fs = require("fs");
const JSZip = require("jszip");
const { XMLParser } = require("fast-xml-parser");
const { DOMParser } = require("@xmldom/xmldom");

const EMU_PER_PT = 12700;

/** Standard slide size in EMU when presentation.xml omits p:sldSz */
const DEFAULT_SLIDE_CX_EMU = 9144000;
const DEFAULT_SLIDE_CY_EMU = 5143500;

const TABLE_URI = "http://schemas.openxmlformats.org/drawingml/2006/table";
const CHART_URI = "http://schemas.openxmlformats.org/drawingml/2006/chart";

const NS_PML = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS_DML = "http://schemas.openxmlformats.org/drawingml/2006/main";

const SHAPE_TAG_KEYS = new Set([
  "p:sp",
  "p:pic",
  "p:graphicFrame",
  "p:grpSp",
  "p:cxnSp",
]);

const ARRAY_TAG_NAMES = [
  "p:sp",
  "p:pic",
  "p:graphicFrame",
  "p:grpSp",
  "p:cxnSp",
];

function createParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    isArray: (name, _jpath, _isLeaf, isAttribute) =>
      !isAttribute && ARRAY_TAG_NAMES.includes(name),
  });
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseEmuInt(val) {
  if (val == null || val === "") return null;
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  return Number.isFinite(n) ? n : null;
}

function findKey(obj, candidates) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return k;
  }
  const keys = Object.keys(obj);
  for (const c of candidates) {
    const short = c.includes(":") ? c.split(":").pop() : c;
    const hit = keys.find((k) => k === short || k.endsWith(`:${short}`));
    if (hit) return hit;
  }
  return null;
}

function getPresentationSldSz(parsed) {
  const rootKey =
    findKey(parsed, ["p:presentation", "presentation"]) ||
    Object.keys(parsed).find((k) => !k.startsWith("@_"));
  if (!rootKey) return { cx: DEFAULT_SLIDE_CX_EMU, cy: DEFAULT_SLIDE_CY_EMU };
  const pres = parsed[rootKey];
  const szKey = findKey(pres, ["p:sldSz", "sldSz"]);
  if (!szKey) return { cx: DEFAULT_SLIDE_CX_EMU, cy: DEFAULT_SLIDE_CY_EMU };
  const sz = pres[szKey];
  const cx = parseEmuInt(sz?.["@_cx"]) ?? DEFAULT_SLIDE_CX_EMU;
  const cy = parseEmuInt(sz?.["@_cy"]) ?? DEFAULT_SLIDE_CY_EMU;
  return { cx, cy };
}

function getSlideRoot(parsed) {
  const k = findKey(parsed, ["p:sld", "sld"]);
  return k ? parsed[k] : null;
}

function getSpTree(sld) {
  if (!sld) return null;
  const cSldKey = findKey(sld, ["p:cSld", "cSld"]);
  if (!cSldKey) return null;
  const cSld = sld[cSldKey];
  const spTreeKey = findKey(cSld, ["p:spTree", "spTree"]);
  return spTreeKey ? cSld[spTreeKey] : null;
}

/**
 * Ordered shape instances under spTree (document order, only known shape tags).
 */
function listSpTreeShapesInOrder(spTree) {
  const out = [];
  if (!spTree || typeof spTree !== "object") return out;
  for (const key of Object.keys(spTree)) {
    if (key.startsWith("@_")) continue;
    if (!SHAPE_TAG_KEYS.has(key)) continue;
    for (const item of asArray(spTree[key])) {
      if (item && typeof item === "object") out.push({ tag: key, node: item });
    }
  }
  return out;
}

function getXfrmBox(tag, node) {
  let xfrm = null;
  if (tag === "p:graphicFrame") {
    const xk = findKey(node, ["p:xfrm", "xfrm"]);
    xfrm = xk ? node[xk] : null;
  } else if (tag === "p:grpSp") {
    const gk = findKey(node, ["p:grpSpPr", "grpSpPr"]);
    const grpSpPr = gk ? node[gk] : null;
    const xk = grpSpPr ? findKey(grpSpPr, ["a:xfrm", "xfrm"]) : null;
    xfrm = xk && grpSpPr ? grpSpPr[xk] : null;
  } else {
    const spPrKey = findKey(node, ["p:spPr", "spPr"]);
    const spPr = spPrKey ? node[spPrKey] : null;
    const xk = spPr ? findKey(spPr, ["a:xfrm", "xfrm"]) : null;
    xfrm = xk && spPr ? spPr[xk] : null;
  }
  if (!xfrm || typeof xfrm !== "object") return null;

  const offKey = findKey(xfrm, ["a:off", "off"]);
  const extKey = findKey(xfrm, ["a:ext", "ext"]);
  const off = offKey ? xfrm[offKey] : null;
  const ext = extKey ? xfrm[extKey] : null;
  const x = parseEmuInt(off?.["@_x"]);
  const y = parseEmuInt(off?.["@_y"]);
  const cx = parseEmuInt(ext?.["@_cx"]);
  const cy = parseEmuInt(ext?.["@_cy"]);
  if (x == null || y == null || cx == null || cy == null) return null;
  return { x, y, cx, cy };
}

function getCNvPr(tag, node) {
  let block = null;
  if (tag === "p:sp") {
    const k = findKey(node, ["p:nvSpPr", "nvSpPr"]);
    block = k ? node[k] : null;
  } else if (tag === "p:pic") {
    const k = findKey(node, ["p:nvPicPr", "nvPicPr"]);
    block = k ? node[k] : null;
  } else if (tag === "p:graphicFrame") {
    const k = findKey(node, ["p:nvGraphicFramePr", "nvGraphicFramePr"]);
    block = k ? node[k] : null;
  } else if (tag === "p:grpSp") {
    const k = findKey(node, ["p:nvGrpSp", "nvGrpSp"]);
    block = k ? node[k] : null;
  } else if (tag === "p:cxnSp") {
    const k = findKey(node, ["p:nvCxnSpPr", "nvCxnSpPr"]);
    block = k ? node[k] : null;
  }
  if (!block) return null;
  const ck = findKey(block, ["p:cNvPr", "cNvPr"]);
  return ck ? block[ck] : null;
}

function getPlaceholderType(spNode) {
  const nvSpKey = findKey(spNode, ["p:nvSpPr", "nvSpPr"]);
  const nvSp = nvSpKey ? spNode[nvSpKey] : null;
  if (!nvSp) return null;
  const nvPrKey = findKey(nvSp, ["p:nvPr", "nvPr"]);
  const nvPr = nvPrKey ? nvSp[nvPrKey] : null;
  if (!nvPr) return null;
  const phKey = findKey(nvPr, ["p:ph", "ph"]);
  const ph = phKey ? nvPr[phKey] : null;
  if (!ph || typeof ph !== "object") return null;
  const t = ph["@_type"];
  return t != null && t !== "" ? String(t) : null;
}

function getGraphicDataUri(graphicFrameNode) {
  const gKey = findKey(graphicFrameNode, ["a:graphic", "graphic"]);
  const graphic = gKey ? graphicFrameNode[gKey] : null;
  if (!graphic) return null;
  const gdKey = findKey(graphic, ["a:graphicData", "graphicData"]);
  const gd = gdKey ? graphic[gdKey] : null;
  const uri = gd?.["@_uri"];
  return uri != null ? String(uri) : null;
}

function classifyShape(tag, node) {
  if (tag === "p:sp") return "text";
  if (tag === "p:pic") return "image";
  if (tag === "p:grpSp") return "group";
  if (tag === "p:cxnSp") return "other";
  if (tag === "p:graphicFrame") {
    const uri = getGraphicDataUri(node);
    if (uri === TABLE_URI) return "table";
    if (uri === CHART_URI) return "chart";
    return "other";
  }
  return "other";
}

function buildPositionSize(box, slideCx, slideCy) {
  const { x, y, cx, cy } = box;
  return {
    position: {
      x: x / EMU_PER_PT,
      y: y / EMU_PER_PT,
      xPct: x / slideCx,
      yPct: y / slideCy,
    },
    size: {
      width: cx / EMU_PER_PT,
      height: cy / EMU_PER_PT,
      widthPct: cx / slideCx,
      heightPct: cy / slideCy,
    },
  };
}

const ALIGN_ATTR_MAP = {
  l: "left",
  ctr: "center",
  r: "right",
  just: "justify",
};

function elementChildrenNS(el, ns, localName) {
  const out = [];
  if (!el || !el.childNodes) return out;
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (c.nodeType === 1 && c.namespaceURI === ns && c.localName === localName) {
      out.push(c);
    }
  }
  return out;
}

function firstChildElementNS(parent, ns, localName) {
  if (!parent || !parent.childNodes) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i];
    if (c.nodeType === 1 && c.namespaceURI === ns && c.localName === localName) {
      return c;
    }
  }
  return null;
}

function getSpTreeDomElement(doc) {
  const root = doc && doc.documentElement;
  if (!root) return null;
  let sld = null;
  if (root.namespaceURI === NS_PML && root.localName === "sld") sld = root;
  else {
    const found = elementChildrenNS(root, NS_PML, "sld");
    sld = found[0] || null;
  }
  if (!sld) return null;
  const cSld = firstChildElementNS(sld, NS_PML, "cSld");
  if (!cSld) return null;
  return firstChildElementNS(cSld, NS_PML, "spTree");
}

function listOrderedShapeDomElements(spTreeEl) {
  const tags = new Set(["sp", "pic", "graphicFrame", "grpSp", "cxnSp"]);
  const out = [];
  if (!spTreeEl || !spTreeEl.childNodes) return out;
  for (let i = 0; i < spTreeEl.childNodes.length; i++) {
    const c = spTreeEl.childNodes[i];
    if (c.nodeType !== 1) continue;
    if (c.namespaceURI === NS_PML && tags.has(c.localName)) out.push(c);
  }
  return out;
}

function stripNullChars(s) {
  return String(s).replace(/\u0000/g, "");
}

function trimRunText(s) {
  return stripNullChars(s).trim();
}

function textFromParsedT(tNode) {
  if (tNode == null) return "";
  if (typeof tNode === "string") return stripNullChars(tNode);
  if (typeof tNode === "object") {
    if (Object.prototype.hasOwnProperty.call(tNode, "#text")) {
      return stripNullChars(tNode["#text"]);
    }
  }
  return "";
}

function collectTextFromDomTElement(tEl) {
  if (!tEl) return "";
  let out = "";
  for (let i = 0; i < tEl.childNodes.length; i++) {
    const n = tEl.childNodes[i];
    if (n.nodeType === 3) out += n.data;
    else if (n.nodeType === 1 && n.namespaceURI === NS_DML && n.localName === "br") {
      out += "\n";
    } else if (n.nodeType === 1) {
      out += collectTextFromDomTElement(n);
    }
  }
  return stripNullChars(out);
}

function firstDirectSolidFillChild(rPrEl) {
  if (!rPrEl || !rPrEl.childNodes) return null;
  for (let i = 0; i < rPrEl.childNodes.length; i++) {
    const c = rPrEl.childNodes[i];
    if (c.nodeType === 1 && c.namespaceURI === NS_DML && c.localName === "solidFill") {
      return c;
    }
  }
  return null;
}

function colorFromRPrDom(rPrEl) {
  const solid = firstDirectSolidFillChild(rPrEl);
  if (!solid) return null;
  const srgb = firstChildElementNS(solid, NS_DML, "srgbClr");
  if (srgb) {
    const v = srgb.getAttribute("val");
    return v ? "#" + v : null;
  }
  const scheme = firstChildElementNS(solid, NS_DML, "schemeClr");
  if (scheme) {
    const v = scheme.getAttribute("val");
    return v ? "theme:" + v : null;
  }
  return null;
}

function readRunFormattingDom(rEl) {
  const rPrEl = firstChildElementNS(rEl, NS_DML, "rPr");
  if (!rPrEl) {
    return {
      fontSize: null,
      bold: false,
      italic: false,
      underline: false,
      color: null,
      fontFamily: null,
    };
  }
  const szAttr = rPrEl.getAttribute("sz");
  const fontSize =
    szAttr != null && szAttr !== "" && Number.isFinite(parseInt(szAttr, 10))
      ? parseInt(szAttr, 10) / 100
      : null;
  const b = rPrEl.getAttribute("b");
  const bold = b === "1" || b === "true" || b === "on" || Number(b) === 1;
  const it = rPrEl.getAttribute("i");
  const italic = it === "1" || it === "true" || it === "on" || Number(it) === 1;
  const u = rPrEl.getAttribute("u");
  const underline = u != null && u !== "" && String(u) !== "none";
  const color = colorFromRPrDom(rPrEl);
  const latins = rPrEl.getElementsByTagNameNS(NS_DML, "latin");
  const latin = latins[0];
  const fontFamily = latin ? latin.getAttribute("typeface") : null;
  return { fontSize, bold, italic, underline, color, fontFamily };
}

function paragraphMetaFromPPrDom(pPrEl) {
  if (!pPrEl) {
    return {
      alignment: null,
      indentLevel: 0,
      hasBullet: false,
      bulletChar: null,
    };
  }
  const algn = pPrEl.getAttribute("algn");
  const alignment = algn && ALIGN_ATTR_MAP[algn] ? ALIGN_ATTR_MAP[algn] : null;
  const lvlAttr = pPrEl.getAttribute("lvl");
  let indentLevel = 0;
  if (lvlAttr != null && lvlAttr !== "") {
    const n = parseInt(lvlAttr, 10);
    indentLevel = Number.isFinite(n) ? n : 0;
  }
  let hasBullet = false;
  let bulletChar = null;
  if (pPrEl.childNodes) {
    for (let i = 0; i < pPrEl.childNodes.length; i++) {
      const c = pPrEl.childNodes[i];
      if (c.nodeType !== 1 || c.namespaceURI !== NS_DML) continue;
      if (c.localName === "buChar" || c.localName === "buAutoNum") {
        hasBullet = true;
      }
      if (c.localName === "buChar") {
        const ch = c.getAttribute("char");
        if (ch != null && ch !== "") bulletChar = ch;
      }
    }
  }
  return { alignment, indentLevel, hasBullet, bulletChar };
}

function collectRunsFromParagraphDom(pEl, paragraphIndex, textRuns, paraTextParts) {
  const pPrEl = firstChildElementNS(pEl, NS_DML, "pPr");
  const paraMeta = paragraphMetaFromPPrDom(pPrEl);
  let runIndex = 0;
  let line = "";

  if (!pEl.childNodes) {
    paraTextParts.push(line);
    return;
  }

  for (let i = 0; i < pEl.childNodes.length; i++) {
    const child = pEl.childNodes[i];
    if (child.nodeType !== 1 || child.namespaceURI !== NS_DML) continue;

    if (child.localName === "r") {
      const tEls = elementChildrenNS(child, NS_DML, "t");
      let raw = "";
      for (let j = 0; j < tEls.length; j++) {
        raw += collectTextFromDomTElement(tEls[j]);
      }
      const trimmed = trimRunText(raw);
      if (trimmed === "") continue;
      const fmt = readRunFormattingDom(child);
      textRuns.push({
        paragraphIndex,
        runIndex,
        text: trimmed,
        fontSize: fmt.fontSize,
        bold: fmt.bold,
        italic: fmt.italic,
        underline: fmt.underline,
        color: fmt.color,
        fontFamily: fmt.fontFamily,
        alignment: paraMeta.alignment,
        indentLevel: paraMeta.indentLevel,
        hasBullet: paraMeta.hasBullet,
        bulletChar: paraMeta.bulletChar,
      });
      line += trimmed;
      runIndex += 1;
    } else if (child.localName === "br") {
      const trimmed = "\n";
      textRuns.push({
        paragraphIndex,
        runIndex,
        text: trimmed,
        fontSize: null,
        bold: false,
        italic: false,
        underline: false,
        color: null,
        fontFamily: null,
        alignment: paraMeta.alignment,
        indentLevel: paraMeta.indentLevel,
        hasBullet: paraMeta.hasBullet,
        bulletChar: paraMeta.bulletChar,
      });
      line += trimmed;
      runIndex += 1;
    } else if (child.localName === "fld") {
      const tEls = child.getElementsByTagNameNS(NS_DML, "t");
      let raw = "";
      for (let j = 0; j < tEls.length; j++) {
        raw += collectTextFromDomTElement(tEls[j]);
      }
      const trimmed = trimRunText(raw);
      if (trimmed === "") continue;
      textRuns.push({
        paragraphIndex,
        runIndex,
        text: trimmed,
        fontSize: null,
        bold: false,
        italic: false,
        underline: false,
        color: null,
        fontFamily: null,
        alignment: paraMeta.alignment,
        indentLevel: paraMeta.indentLevel,
        hasBullet: paraMeta.hasBullet,
        bulletChar: paraMeta.bulletChar,
      });
      line += trimmed;
      runIndex += 1;
    }
  }

  paraTextParts.push(line);
}

function extractTextRunsFromSpDom(domSpEl) {
  const textRuns = [];
  const paraTextParts = [];
  const txBody = firstChildElementNS(domSpEl, NS_PML, "txBody");
  if (!txBody || !txBody.childNodes) {
    return { textRuns, fullText: "" };
  }

  let paragraphIndex = 0;
  for (let i = 0; i < txBody.childNodes.length; i++) {
    const c = txBody.childNodes[i];
    if (c.nodeType !== 1 || c.namespaceURI !== NS_DML || c.localName !== "p") continue;
    collectRunsFromParagraphDom(c, paragraphIndex, textRuns, paraTextParts);
    paragraphIndex += 1;
  }

  const fullText = paraTextParts.join("\n");
  return { textRuns, fullText };
}

function paragraphMetaFromPPrObject(pPrObj) {
  if (!pPrObj || typeof pPrObj !== "object") {
    return {
      alignment: null,
      indentLevel: 0,
      hasBullet: false,
      bulletChar: null,
    };
  }
  const algn = pPrObj["@_algn"];
  const alignment =
    algn && ALIGN_ATTR_MAP[String(algn)] ? ALIGN_ATTR_MAP[String(algn)] : null;
  const lvlAttr = pPrObj["@_lvl"];
  let indentLevel = 0;
  if (lvlAttr != null && lvlAttr !== "") {
    const n = parseInt(String(lvlAttr), 10);
    indentLevel = Number.isFinite(n) ? n : 0;
  }
  let hasBullet = false;
  let bulletChar = null;
  const buCharKey = findKey(pPrObj, ["a:buChar", "buChar"]);
  const buAutoKey = findKey(pPrObj, ["a:buAutoNum", "buAutoNum"]);
  if (buCharKey || buAutoKey) hasBullet = true;
  if (buCharKey) {
    const bu = pPrObj[buCharKey];
    const one = Array.isArray(bu) ? bu[0] : bu;
    const ch = one && one["@_char"];
    if (ch != null && ch !== "") bulletChar = String(ch);
  }
  return { alignment, indentLevel, hasBullet, bulletChar };
}

function firstDirectSolidFillInRPr(rPrObj) {
  if (!rPrObj || typeof rPrObj !== "object") return null;
  const sk = findKey(rPrObj, ["a:solidFill", "solidFill"]);
  return sk ? rPrObj[sk] : null;
}

function colorFromRPrObject(rPrObj) {
  const solid = firstDirectSolidFillInRPr(rPrObj);
  if (!solid || typeof solid !== "object") return null;
  const srgbK = findKey(solid, ["a:srgbClr", "srgbClr"]);
  if (srgbK) {
    const node = solid[srgbK];
    const one = Array.isArray(node) ? node[0] : node;
    const v = one && one["@_val"];
    return v ? "#" + v : null;
  }
  const schemeK = findKey(solid, ["a:schemeClr", "schemeClr"]);
  if (schemeK) {
    const node = solid[schemeK];
    const one = Array.isArray(node) ? node[0] : node;
    const v = one && one["@_val"];
    return v ? "theme:" + v : null;
  }
  return null;
}

function readRunFormattingObject(rObj) {
  const rPrKey = findKey(rObj, ["a:rPr", "rPr"]);
  const rPr = rPrKey ? rObj[rPrKey] : null;
  const rPrObj = Array.isArray(rPr) ? rPr[0] : rPr;
  if (!rPrObj || typeof rPrObj !== "object") {
    return {
      fontSize: null,
      bold: false,
      italic: false,
      underline: false,
      color: null,
      fontFamily: null,
    };
  }
  const szAttr = rPrObj["@_sz"];
  const fontSize =
    szAttr != null && szAttr !== "" && Number.isFinite(parseInt(String(szAttr), 10))
      ? parseInt(String(szAttr), 10) / 100
      : null;
  const b = rPrObj["@_b"];
  const bold = b === "1" || b === "true" || b === "on" || Number(b) === 1;
  const it = rPrObj["@_i"];
  const italic = it === "1" || it === "true" || it === "on" || Number(it) === 1;
  const u = rPrObj["@_u"];
  const underline = u != null && u !== "" && String(u) !== "none";
  const color = colorFromRPrObject(rPrObj);
  const latinK = findKey(rPrObj, ["a:latin", "latin"]);
  let fontFamily = null;
  if (latinK) {
    const lat = rPrObj[latinK];
    const one = Array.isArray(lat) ? lat[0] : lat;
    const tf = one && one["@_typeface"];
    if (tf != null && tf !== "") fontFamily = String(tf);
  }
  return { fontSize, bold, italic, underline, color, fontFamily };
}

function extractTextRunsFromSpObject(spNode) {
  const textRuns = [];
  const paraTextParts = [];
  const txKey = findKey(spNode, ["p:txBody", "txBody"]);
  const txBody = txKey ? spNode[txKey] : null;
  if (!txBody || typeof txBody !== "object") {
    return { textRuns, fullText: "" };
  }

  const pKey = findKey(txBody, ["a:p", "p"]);
  const paragraphs = pKey ? asArray(txBody[pKey]) : [];

  paragraphs.forEach((pObj, paragraphIndex) => {
    if (!pObj || typeof pObj !== "object") return;
    const pPrKey = findKey(pObj, ["a:pPr", "p:pPr", "pPr"]);
    let pPrRaw = pPrKey ? pObj[pPrKey] : null;
    pPrRaw = Array.isArray(pPrRaw) ? pPrRaw[0] : pPrRaw;
    const paraMeta = paragraphMetaFromPPrObject(pPrRaw);
    let runIndex = 0;
    let line = "";

    const rKey = findKey(pObj, ["a:r", "r"]);
    const runs = rKey ? asArray(pObj[rKey]) : [];
    for (let ri = 0; ri < runs.length; ri++) {
      const rObj = runs[ri];
      if (!rObj || typeof rObj !== "object") continue;
      const tKey = findKey(rObj, ["a:t", "t"]);
      const tVal = tKey ? rObj[tKey] : null;
      const raw = textFromParsedT(tVal);
      const trimmed = trimRunText(raw);
      if (trimmed === "") continue;
      const fmt = readRunFormattingObject(rObj);
      textRuns.push({
        paragraphIndex,
        runIndex,
        text: trimmed,
        fontSize: fmt.fontSize,
        bold: fmt.bold,
        italic: fmt.italic,
        underline: fmt.underline,
        color: fmt.color,
        fontFamily: fmt.fontFamily,
        alignment: paraMeta.alignment,
        indentLevel: paraMeta.indentLevel,
        hasBullet: paraMeta.hasBullet,
        bulletChar: paraMeta.bulletChar,
      });
      line += trimmed;
      runIndex += 1;
    }

    const brKey = findKey(pObj, ["a:br", "br"]);
    const brs = brKey ? asArray(pObj[brKey]) : [];
    for (let bi = 0; bi < brs.length; bi++) {
      textRuns.push({
        paragraphIndex,
        runIndex,
        text: "\n",
        fontSize: null,
        bold: false,
        italic: false,
        underline: false,
        color: null,
        fontFamily: null,
        alignment: paraMeta.alignment,
        indentLevel: paraMeta.indentLevel,
        hasBullet: paraMeta.hasBullet,
        bulletChar: paraMeta.bulletChar,
      });
      line += "\n";
      runIndex += 1;
    }

    const fldKey = findKey(pObj, ["a:fld", "fld"]);
    const flds = fldKey ? asArray(pObj[fldKey]) : [];
    for (let fi = 0; fi < flds.length; fi++) {
      const fld = flds[fi];
      if (!fld || typeof fld !== "object") continue;
      const ftKey = findKey(fld, ["a:t", "t"]);
      const raw = textFromParsedT(ftKey ? fld[ftKey] : null);
      const trimmed = trimRunText(raw);
      if (trimmed === "") continue;
      textRuns.push({
        paragraphIndex,
        runIndex,
        text: trimmed,
        fontSize: null,
        bold: false,
        italic: false,
        underline: false,
        color: null,
        fontFamily: null,
        alignment: paraMeta.alignment,
        indentLevel: paraMeta.indentLevel,
        hasBullet: paraMeta.hasBullet,
        bulletChar: paraMeta.bulletChar,
      });
      line += trimmed;
      runIndex += 1;
    }

    paraTextParts.push(line);
  });

  return { textRuns, fullText: paraTextParts.join("\n") };
}

/**
 * @param {object} spNode Parsed p:sp object (fast-xml-parser)
 * @param {import('fast-xml-parser').XMLParser} parser Shared parser instance (reserved / parity with Phase 1 API)
 * @param {import('@xmldom/xmldom').Element | null} [domSpEl] Matching p:sp DOM node for correct a:r / a:br order
 */
function extractTextRuns(spNode, parser, domSpEl) {
  void parser;
  if (domSpEl) {
    return extractTextRunsFromSpDom(domSpEl);
  }
  return extractTextRunsFromSpObject(spNode);
}

function shapeFromEntry({ tag, node }, zIndex, slideCx, slideCy) {
  const cNvPr = getCNvPr(tag, node);
  const shapeId = cNvPr?.["@_id"] != null ? String(cNvPr["@_id"]) : "";
  const shapeName = cNvPr?.["@_name"] != null ? String(cNvPr["@_name"]) : "";

  const box = getXfrmBox(tag, node);
  let position = null;
  let size = null;
  if (box) {
    const ps = buildPositionSize(box, slideCx, slideCy);
    position = ps.position;
    size = ps.size;
  }

  const placeholderType = tag === "p:sp" ? getPlaceholderType(node) : null;

  return {
    shapeId,
    shapeName,
    shapeType: classifyShape(tag, node),
    position,
    size,
    placeholderType,
    textRuns: [],
    fullText: "",
    zIndex,
  };
}

function slidePathsFromZip(zip) {
  const paths = [];
  zip.forEach((relPath, file) => {
    if (file.dir) return;
    const m = relPath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (m) paths.push({ path: relPath, num: parseInt(m[1], 10) });
  });
  paths.sort((a, b) => a.num - b.num);
  return paths;
}

/**
 * Extract shape geometry from a .pptx file path.
 * @param {string} filePath Absolute or relative path to .pptx
 * @returns {Promise<{ slideIndex: number, shapes: object[] }[]>}
 */
async function extractShapes(filePath) {
  const buf = await fs.promises.readFile(filePath);
  const zip = await JSZip.loadAsync(buf);

  const presFile = zip.file("ppt/presentation.xml");
  const parser = createParser();
  let slideCx = DEFAULT_SLIDE_CX_EMU;
  let slideCy = DEFAULT_SLIDE_CY_EMU;
  if (presFile) {
    const presXml = await presFile.async("string");
    const presParsed = parser.parse(presXml);
    const dim = getPresentationSldSz(presParsed);
    slideCx = dim.cx;
    slideCy = dim.cy;
  }

  const slideEntries = slidePathsFromZip(zip);
  const results = [];

  for (const { path: slidePath, num: slideNum } of slideEntries) {
    const f = zip.file(slidePath);
    if (!f) continue;
    const xml = await f.async("string");
    const parsed = parser.parse(xml);
    const sld = getSlideRoot(parsed);
    const spTree = getSpTree(sld);
    const ordered = listSpTreeShapesInOrder(spTree);

    let domShapeEls = [];
    try {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const spTreeEl = getSpTreeDomElement(doc);
      if (spTreeEl) domShapeEls = listOrderedShapeDomElements(spTreeEl);
    } catch (_e) {
      domShapeEls = [];
    }
    const domAligned = domShapeEls.length === ordered.length;

    const shapes = ordered.map((entry, i) => {
      const shape = shapeFromEntry(entry, i, slideCx, slideCy);
      if (entry.tag === "p:sp") {
        const domSp = domAligned ? domShapeEls[i] : null;
        const extracted = extractTextRuns(entry.node, parser, domSp);
        shape.textRuns = extracted.textRuns;
        shape.fullText = extracted.fullText;
      }
      return shape;
    });
    results.push({ slideIndex: slideNum, shapes });
  }

  return results;
}

module.exports = { extractShapes };

if (require.main === module) {
  const sample = process.argv[2];
  if (!sample) {
    console.error("Usage: node src/ooxml/shapeExtractor.js <path-to.pptx>");
    process.exit(1);
  }
  extractShapes(sample)
    .then((out) => {
      console.log(JSON.stringify(out, null, 2));
      const slide1 = out.find((s) => s.slideIndex === 1);
      if (slide1 && Array.isArray(slide1.shapes)) {
        const n = Math.min(2, slide1.shapes.length);
        for (let i = 0; i < n; i++) {
          const sh = slide1.shapes[i];
          console.log(`--- slide 1 shape[${i}] textRuns / fullText ---`);
          console.log(
            JSON.stringify({ textRuns: sh.textRuns, fullText: sh.fullText }, null, 2)
          );
        }
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
