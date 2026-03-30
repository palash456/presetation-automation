"use client";

import JSZip from "jszip";
import type { CompanyTemplate } from "./company-types";
import type { RegionKind, SlideTemplateDefinition, TemplateRegion } from "./types";

const EMU_PER_INCH = 914400;

function parseSlideSizeEMU(xml: string): { cx: number; cy: number } {
  const m = xml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  if (m) {
    return { cx: parseInt(m[1], 10), cy: parseInt(m[2], 10) };
  }
  const m2 = xml.match(/cx="(\d+)"/);
  const m3 = xml.match(/cy="(\d+)"/);
  if (m2 && m3) {
    return { cx: parseInt(m2[1], 10), cy: parseInt(m3[1], 10) };
  }
  return { cx: 13 * EMU_PER_INCH, cy: (13 * EMU_PER_INCH * 9) / 16 };
}

function attr(block: string, name: string): number | null {
  const m = block.match(new RegExp(`${name}="(\\d+)"`));
  return m ? parseInt(m[1], 10) : null;
}

function firstTextLabel(xmlChunk: string): string {
  const m = xmlChunk.match(/<a:t>([^<]*)<\/a:t>/);
  const t = m?.[1]?.trim() ?? "";
  return t.length > 0 ? t.slice(0, 72) : "";
}

/**
 * Match editor canvas 16:9 (960×540) so normalized regions align 1:1 with pixels.
 * JPEG size is bounded by quality, not resolution.
 */
const PREVIEW_W = 960;
const PREVIEW_H = 540;

function slideRelsPath(slidePath: string): string {
  const m = slidePath.match(/^(.*\/)([^/]+)$/);
  if (!m) return "";
  return `${m[1]}_rels/${m[2]}.rels`;
}

function resolveRelTarget(slidePath: string, target: string): string {
  const base = slidePath.replace(/[^/]+$/, "");
  const parts = base.split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

function parseRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  let idx = 0;
  while (idx < relsXml.length) {
    const start = relsXml.indexOf("<Relationship", idx);
    if (start === -1) break;
    const end = relsXml.indexOf(">", start);
    if (end === -1) break;
    const slice = relsXml.slice(start, end + 1);
    const idM = slice.match(/\bId="([^"]+)"/);
    const targetM = slice.match(/\bTarget="([^"]+)"/);
    if (idM && targetM) map.set(idM[1], targetM[1]);
    idx = end + 1;
  }
  return map;
}

function zipFileCI(zip: JSZip, path: string) {
  const direct = zip.file(path);
  if (direct && !direct.dir) return direct;
  const lower = path.toLowerCase();
  for (const k of Object.keys(zip.files)) {
    if (!zip.files[k]!.dir && k.toLowerCase() === lower) return zip.file(k)!;
  }
  return null;
}

type PicPlacement = { rId: string; x: number; y: number; cx: number; cy: number };

function extractPicturePlacements(
  slideXml: string,
  slideW: number,
  slideH: number,
): PicPlacement[] {
  const placements: PicPlacement[] = [];
  const head = slideXml.slice(0, 16000);

  const bgBlock =
    head.match(/<p:bg\b[\s\S]*?<\/p:bg>/)?.[0] ??
    head.match(/<p:bgPr\b[\s\S]*?<\/p:bgPr>/)?.[0];
  if (bgBlock) {
    const embed = bgBlock.match(/r:embed="([^"]+)"/);
    if (embed) {
      placements.push({
        rId: embed[1],
        x: 0,
        y: 0,
        cx: slideW,
        cy: slideH,
      });
    }
  }

  let search = 0;
  while (search < slideXml.length) {
    const picStart = slideXml.indexOf("<p:pic", search);
    if (picStart === -1) break;
    const picEnd = slideXml.indexOf("</p:pic>", picStart);
    const block =
      picEnd === -1
        ? slideXml.slice(picStart)
        : slideXml.slice(picStart, picEnd + 8);
    const embed = block.match(/r:embed="([^"]+)"/);
    if (!embed) {
      search = picStart + 6;
      continue;
    }
    const xfrm = block.match(/<a:xfrm[\s\S]*?<\/a:xfrm>/);
    if (!xfrm) {
      search = picStart + 6;
      continue;
    }
    const off = xfrm[0].match(/x="(\d+)"[^>]*y="(\d+)"/);
    const ext = xfrm[0].match(/cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!off || !ext) {
      search = picStart + 6;
      continue;
    }
    placements.push({
      rId: embed[1],
      x: parseInt(off[1], 10),
      y: parseInt(off[2], 10),
      cx: parseInt(ext[1], 10),
      cy: parseInt(ext[2], 10),
    });
    search = picStart + 6;
  }

  search = 0;
  while (search < slideXml.length) {
    const spStart = slideXml.indexOf("<p:sp", search);
    if (spStart === -1) break;
    const spEnd = slideXml.indexOf("</p:sp>", spStart);
    const sblock =
      spEnd === -1
        ? slideXml.slice(spStart)
        : slideXml.slice(spStart, spEnd + 7);
    if (!/blipFill|a:blip/.test(sblock)) {
      search = spStart + 5;
      continue;
    }
    const embed = sblock.match(/r:embed="([^"]+)"/);
    if (!embed) {
      search = spStart + 5;
      continue;
    }
    const xfrm = sblock.match(/<a:xfrm[\s\S]*?<\/a:xfrm>/);
    if (!xfrm) {
      search = spStart + 5;
      continue;
    }
    const off = xfrm[0].match(/x="(\d+)"[^>]*y="(\d+)"/);
    const ext = xfrm[0].match(/cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!off || !ext) {
      search = spStart + 5;
      continue;
    }
    placements.push({
      rId: embed[1],
      x: parseInt(off[1], 10),
      y: parseInt(off[2], 10),
      cx: parseInt(ext[1], 10),
      cy: parseInt(ext[2], 10),
    });
    search = spStart + 5;
  }

  return placements.slice(0, 22);
}

type PlacementWithSource = PicPlacement & { sourcePath: string };

function tagPlacements(path: string, list: PicPlacement[]): PlacementWithSource[] {
  return list.map((p) => ({ ...p, sourcePath: path }));
}

async function gatherPicturePlacementsWithSource(
  zip: JSZip,
  slidePath: string,
  slideXml: string,
  slideW: number,
  slideH: number,
): Promise<PlacementWithSource[]> {
  const merged: PlacementWithSource[] = [];
  const relPath = slideRelsPath(slidePath);
  const relFile = zipFileCI(zip, relPath);
  if (relFile) {
    const rels = parseRelationships(await relFile.async("string"));
    for (const target of rels.values()) {
      const tl = target.toLowerCase();
      if (!tl.includes("slidelayout")) continue;
      const layoutPath = resolveRelTarget(slidePath, target);
      const lf = zipFileCI(zip, layoutPath);
      if (!lf) continue;
      const layoutXml = await lf.async("string");
      merged.push(
        ...tagPlacements(
          layoutPath,
          extractPicturePlacements(layoutXml, slideW, slideH),
        ),
      );
    }
  }
  merged.push(
    ...tagPlacements(
      slidePath,
      extractPicturePlacements(slideXml, slideW, slideH),
    ),
  );

  const seen = new Set<string>();
  const out: PlacementWithSource[] = [];
  for (const item of merged) {
    const k = `${item.sourcePath}|${item.rId}|${item.x}|${item.y}|${item.cx}|${item.cy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out.slice(0, 26);
}

async function loadDrawableImage(blob: Blob): Promise<CanvasImageSource> {
  try {
    return await createImageBitmap(blob);
  } catch {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }
}

async function rasterizeSlideToDataUrl(
  zip: JSZip,
  slidePath: string,
  slideXml: string,
  slideW: number,
  slideH: number,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const placements = await gatherPicturePlacementsWithSource(
    zip,
    slidePath,
    slideXml,
    slideW,
    slideH,
  );
  if (placements.length === 0) return null;

  const relsCache = new Map<string, Map<string, string>>();
  async function relMapFor(sourcePath: string): Promise<Map<string, string>> {
    const hit = relsCache.get(sourcePath);
    if (hit) return hit;
    const rp = slideRelsPath(sourcePath);
    const f = zipFileCI(zip, rp);
    if (!f) {
      const empty = new Map<string, string>();
      relsCache.set(sourcePath, empty);
      return empty;
    }
    const m = parseRelationships(await f.async("string"));
    relsCache.set(sourcePath, m);
    return m;
  }

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_W;
  canvas.height = PREVIEW_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  for (const p of placements) {
    const rels = await relMapFor(p.sourcePath);
    const target = rels.get(p.rId);
    if (!target) continue;
    const internalPath = resolveRelTarget(p.sourcePath, target);
    const media = zipFileCI(zip, internalPath);
    if (!media) continue;
    let blob: Blob;
    try {
      blob = await media.async("blob");
    } catch {
      continue;
    }
    if (blob.size < 32) continue;

    let drawable: CanvasImageSource;
    try {
      drawable = await loadDrawableImage(blob);
    } catch {
      continue;
    }

    const dx = (p.x / slideW) * PREVIEW_W;
    const dy = (p.y / slideH) * PREVIEW_H;
    const dw = (p.cx / slideW) * PREVIEW_W;
    const dh = (p.cy / slideH) * PREVIEW_H;
    if (dw < 1 || dh < 1) {
      if ("close" in drawable && typeof drawable.close === "function") {
        (drawable as ImageBitmap).close();
      }
      continue;
    }

    try {
      ctx.drawImage(drawable, dx, dy, dw, dh);
    } catch {
      /* ignore draw errors */
    }
    if ("close" in drawable && typeof drawable.close === "function") {
      (drawable as ImageBitmap).close();
    }
  }

  try {
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return null;
  }
}

type RawBox = { x: number; y: number; cx: number; cy: number; label: string };

function extractBoxesFromSlideXml(xml: string): RawBox[] {
  const boxes: RawBox[] = [];
  const seen = new Set<string>();
  let pos = 0;
  while (pos < xml.length) {
    const xi = xml.indexOf("a:xfrm", pos);
    if (xi === -1) break;
    const chunk = xml.slice(xi, xi + 1500);
    const offOpen = chunk.match(/<a:off\b([^/>]*)\/?>/);
    const extOpen = chunk.match(/<a:ext\b([^/>]*)\/?>/);
    if (!offOpen || !extOpen) {
      pos = xi + 6;
      continue;
    }
    const x = attr(offOpen[1], "x");
    const y = attr(offOpen[1], "y");
    const cx = attr(extOpen[1], "cx");
    const cy = attr(extOpen[1], "cy");
    if (x == null || y == null || cx == null || cy == null) {
      pos = xi + 6;
      continue;
    }
    if (cx < 50000 || cy < 50000) {
      pos = xi + 6;
      continue;
    }
    const key = `${x},${y},${cx},${cy}`;
    if (seen.has(key)) {
      pos = xi + 6;
      continue;
    }
    seen.add(key);
    const ctxStart = Math.max(0, xi - 4000);
    const label =
      firstTextLabel(xml.slice(ctxStart, xi + 1500)) ||
      `Shape ${boxes.length + 1}`;
    boxes.push({ x, y, cx, cy, label });
    pos = xi + 6;
  }
  return boxes;
}

function kindForBox(
  box: RawBox,
  slideW: number,
  slideH: number,
  index: number,
): RegionKind {
  const ar = box.cx / Math.max(box.cy, 1);
  const area = (box.cx / slideW) * (box.cy / slideH);
  if (index === 0 && box.y < slideH * 0.22 && area < 0.12) return "text";
  if (ar > 1.35 && area > 0.08) return "image";
  return "text";
}

function toRegion(
  box: RawBox,
  slideW: number,
  slideH: number,
  slideIndex: number,
  index: number,
): TemplateRegion {
  const nx = box.x / slideW;
  const ny = box.y / slideH;
  const nw = box.cx / slideW;
  const nh = box.cy / slideH;
  const kind = kindForBox(box, slideW, slideH, index);
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const x = clamp(nx, 0, 0.98);
  const y = clamp(ny, 0, 0.98);
  const w = clamp(nw, 0.02, 1 - x);
  const h = clamp(nh, 0.02, 1 - y);
  return {
    id: `reg-s${slideIndex}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    label: box.label,
    kind,
    x,
    y,
    w,
    h,
    maxChars: kind === "text" ? Math.min(1200, Math.round(w * h * 8000)) : 0,
    ...(kind === "text"
      ? { textAlign: "start" as const, overflow: "clip" as const }
      : { aspectLocked: true, imageFit: "cover" as const }),
  };
}

function slideDefinitionFromParsed(
  slideIndex: number,
  slideName: string,
  boxes: RawBox[],
  slideW: number,
  slideH: number,
  slidePreviewDataUrl?: string | null,
): SlideTemplateDefinition {
  let regions =
    boxes.length > 0
      ? boxes.map((b, i) => toRegion(b, slideW, slideH, slideIndex, i))
      : [
          {
            id: `reg-s${slideIndex}-imported`,
            label: "Body",
            kind: "text" as const,
            x: 0.08,
            y: 0.15,
            w: 0.84,
            h: 0.72,
            maxChars: 800,
            textAlign: "start" as const,
            overflow: "clip" as const,
          },
        ];

  regions = regions.filter((r) => r.w >= 0.02 && r.h >= 0.02);

  return {
    id: `import-slide-${slideIndex + 1}`,
    name: slideName,
    useCase: slideIndex === 0 ? "Title" : "Content",
    status: "needs_review",
    templateType: slideIndex === 0 ? "Title slide" : "Bullet slide",
    regions,
    layoutRule: "flexible",
    spacing: { padding: 40, margin: 48 },
    designTags: ["Imported", "PPTX"],
    density: "medium",
    allowedElements: ["text", "image", "chart", "shape"],
    ...(slidePreviewDataUrl ? { slidePreviewDataUrl } : {}),
  };
}

/**
 * Build a template pack from a .pptx file (client-side).
 * Layout is approximated from shape transforms; refine in the canvas editor.
 */
export async function pptxFileToCompanyTemplate(file: File): Promise<CompanyTemplate> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const presFile = zip.file("ppt/presentation.xml");
  if (!presFile) {
    throw new Error("Not a valid .pptx (missing presentation.xml).");
  }
  const presXml = await presFile.async("string");
  const { cx: slideW, cy: slideH } = parseSlideSizeEMU(presXml);

  const slidePaths = Object.keys(zip.files)
    .filter(
      (p) =>
        /^ppt\/slides\/slide\d+\.xml$/i.test(p) && !zip.files[p]!.dir,
    )
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return na - nb;
    });

  if (slidePaths.length === 0) {
    throw new Error("No slides found in this .pptx.");
  }

  const defs: SlideTemplateDefinition[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const path = slidePaths[i]!;
    const xml = await zip.file(path)!.async("string");
    const boxes = extractBoxesFromSlideXml(xml);
    const slidePreviewDataUrl = await rasterizeSlideToDataUrl(
      zip,
      path,
      xml,
      slideW,
      slideH,
    );
    defs.push(
      slideDefinitionFromParsed(
        i,
        `Slide ${i + 1}`,
        boxes,
        slideW,
        slideH,
        slidePreviewDataUrl,
      ),
    );
  }

  const baseName = file.name.replace(/\.pptx$/i, "") || "Imported deck";

  return {
    id: `co-pptx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: baseName,
    shortDescription: `Imported from ${file.name} · ${defs.length} slide(s)`,
    industry: "General",
    style: "Minimal",
    presentationUseCases: ["Internal"],
    styleTags: ["Imported", "PowerPoint"],
    slideTemplates: defs,
  };
}
