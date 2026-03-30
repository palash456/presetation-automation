"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BarChart3,
  Image as ImageIcon,
  Lock,
  Shapes,
  Sparkles,
  Type,
} from "lucide-react";
import type { RegionKind, TemplateRegion } from "./types";

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
const GRID_STEPS = 24;
const MIN_W = 0.04;
const MIN_H = 0.04;
const SNAP_THRESHOLD_X = 6 / CANVAS_WIDTH;
const SNAP_THRESHOLD_Y = 6 / CANVAS_HEIGHT;

type Bounds = { x: number; y: number; w: number; h: number };
type CanvasMetrics = { left: number; top: number; width: number; height: number };
type Handle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type DragMode =
  | {
      kind: "move";
      ids: string[];
      sx: number;
      sy: number;
      origin: Map<string, Bounds>;
    }
  | {
      kind: "resize";
      ids: string[];
      sx: number;
      sy: number;
      origin: Map<string, Bounds>;
      bounds: Bounds;
      handle: Handle;
      keepAspect: boolean;
      fromCenter: boolean;
    };

export type TemplateCanvasViewMode = "design" | "metadata";

export type TemplateCanvasEditorProps = {
  regions: TemplateRegion[];
  onRegionsChange: (next: TemplateRegion[]) => void;
  marginPct: number;
  padPct: number;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  /** Design = slide only (locked). Metadata = slide + region overlays. */
  viewMode: TemplateCanvasViewMode;
  showGrid: boolean;
  snapEnabled: boolean;
  className?: string;
  onTransformStart?: () => void;
  /** Full-slide raster from PPTX — visual source of truth; regions are overlays only. */
  slideBackgroundSrc?: string | null;
};

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function getCanvasMetrics(el: HTMLDivElement | null): CanvasMetrics {
  if (!el) {
    return { left: 0, top: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
  }
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function boundsFor(regions: TemplateRegion[]): Bounds | null {
  if (regions.length === 0) return null;
  const minX = Math.min(...regions.map((r) => r.x));
  const minY = Math.min(...regions.map((r) => r.y));
  const maxX = Math.max(...regions.map((r) => r.x + r.w));
  const maxY = Math.max(...regions.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function regionIcon(kind: RegionKind) {
  switch (kind) {
    case "text":
      return Type;
    case "image":
      return ImageIcon;
    case "shape":
      return Shapes;
    case "chart":
      return BarChart3;
    case "icon":
      return Sparkles;
    default:
      return Type;
  }
}

function snapMoveBox(
  box: Bounds,
  regions: TemplateRegion[],
  excludeIds: Set<string>,
  inset: number,
  enableSnap: boolean,
) {
  if (!enableSnap) return { box, vx: undefined as number | undefined, hy: undefined as number | undefined };

  const xCandidates = [0, inset, 0.5, 1 - inset, 1];
  const yCandidates = [0, inset, 0.5, 1 - inset, 1];
  for (const r of regions) {
    if (excludeIds.has(r.id)) continue;
    xCandidates.push(r.x, r.x + r.w / 2, r.x + r.w);
    yCandidates.push(r.y, r.y + r.h / 2, r.y + r.h);
  }

  const pointsX = [box.x, box.x + box.w / 2, box.x + box.w];
  const pointsY = [box.y, box.y + box.h / 2, box.y + box.h];
  let bestDx = 0;
  let bestVx: number | undefined;
  let bestDistX = SNAP_THRESHOLD_X + 1;
  for (const p of pointsX) {
    for (const c of xCandidates) {
      const d = c - p;
      if (Math.abs(d) < bestDistX && Math.abs(d) <= SNAP_THRESHOLD_X) {
        bestDistX = Math.abs(d);
        bestDx = d;
        bestVx = c;
      }
    }
  }
  let bestDy = 0;
  let bestHy: number | undefined;
  let bestDistY = SNAP_THRESHOLD_Y + 1;
  for (const p of pointsY) {
    for (const c of yCandidates) {
      const d = c - p;
      if (Math.abs(d) < bestDistY && Math.abs(d) <= SNAP_THRESHOLD_Y) {
        bestDistY = Math.abs(d);
        bestDy = d;
        bestHy = c;
      }
    }
  }

  return {
    box: { ...box, x: box.x + bestDx, y: box.y + bestDy },
    vx: bestVx,
    hy: bestHy,
  };
}

function normalizeBox(box: Bounds) {
  let { x, y, w, h } = box;
  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }
  if (h < 0) {
    y += h;
    h = Math.abs(h);
  }
  w = Math.max(MIN_W, w);
  h = Math.max(MIN_H, h);
  x = clamp(x, 0, 1 - w);
  y = clamp(y, 0, 1 - h);
  return { x, y, w, h };
}

function applyFrameToSelection(
  regions: TemplateRegion[],
  ids: Set<string>,
  from: Bounds,
  to: Bounds,
) {
  const fromW = Math.max(from.w, MIN_W);
  const fromH = Math.max(from.h, MIN_H);
  return regions.map((r) => {
    if (!ids.has(r.id) || r.locked) return r;
    const rx = (r.x - from.x) / fromW;
    const ry = (r.y - from.y) / fromH;
    const rw = r.w / fromW;
    const rh = r.h / fromH;
    const next = {
      ...r,
      x: to.x + rx * to.w,
      y: to.y + ry * to.h,
      w: to.w * rw,
      h: to.h * rh,
    };
    next.x = clamp(next.x, 0, 1 - next.w);
    next.y = clamp(next.y, 0, 1 - next.h);
    return next;
  });
}

function nextBoxFromHandle(
  bounds: Bounds,
  handle: Handle,
  dx: number,
  dy: number,
  keepAspect: boolean,
  fromCenter: boolean,
) {
  let left = bounds.x;
  let top = bounds.y;
  let right = bounds.x + bounds.w;
  let bottom = bounds.y + bounds.h;

  if (handle.includes("e")) right += dx;
  if (handle.includes("s")) bottom += dy;
  if (handle.includes("w")) left += dx;
  if (handle.includes("n")) top += dy;

  if (fromCenter) {
    if (handle.includes("e") || handle.includes("w")) {
      const half = (right - left) / 2;
      const cx = bounds.x + bounds.w / 2;
      left = cx - half;
      right = cx + half;
    }
    if (handle.includes("n") || handle.includes("s")) {
      const half = (bottom - top) / 2;
      const cy = bounds.y + bounds.h / 2;
      top = cy - half;
      bottom = cy + half;
    }
  }

  let next = normalizeBox({
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  });

  if (keepAspect) {
    const aspect = Math.max(bounds.w, MIN_W) / Math.max(bounds.h, MIN_H);
    const widthFirst = Math.abs(dx) >= Math.abs(dy);
    if (widthFirst) {
      next.h = next.w / aspect;
    } else {
      next.w = next.h * aspect;
    }
    if (handle.includes("w")) next.x = bounds.x + bounds.w - next.w;
    if (handle.includes("n")) next.y = bounds.y + bounds.h - next.h;
    if (fromCenter) {
      next.x = bounds.x + bounds.w / 2 - next.w / 2;
      next.y = bounds.y + bounds.h / 2 - next.h / 2;
    }
    next = normalizeBox(next);
  }

  return next;
}

function snapResizeBox(
  box: Bounds,
  bounds: Bounds,
  handle: Handle,
  regions: TemplateRegion[],
  excludeIds: Set<string>,
  inset: number,
  enableSnap: boolean,
) {
  if (!enableSnap) return { box, vx: undefined as number | undefined, hy: undefined as number | undefined };

  const xCandidates = [0, inset, 0.5, 1 - inset, 1];
  const yCandidates = [0, inset, 0.5, 1 - inset, 1];
  for (const r of regions) {
    if (excludeIds.has(r.id)) continue;
    xCandidates.push(r.x, r.x + r.w / 2, r.x + r.w);
    yCandidates.push(r.y, r.y + r.h / 2, r.y + r.h);
  }

  const next = { ...box };
  let vx: number | undefined;
  let hy: number | undefined;

  if (handle.includes("e")) {
    const edge = next.x + next.w;
    for (const c of xCandidates) {
      const d = c - edge;
      if (Math.abs(d) <= SNAP_THRESHOLD_X) {
        next.w = Math.max(MIN_W, next.w + d);
        vx = c;
        break;
      }
    }
  } else if (handle.includes("w")) {
    const edge = next.x;
    const right = bounds.x + bounds.w;
    for (const c of xCandidates) {
      const d = c - edge;
      if (Math.abs(d) <= SNAP_THRESHOLD_X) {
        next.x = c;
        next.w = Math.max(MIN_W, right - c);
        vx = c;
        break;
      }
    }
  }

  if (handle.includes("s")) {
    const edge = next.y + next.h;
    for (const c of yCandidates) {
      const d = c - edge;
      if (Math.abs(d) <= SNAP_THRESHOLD_Y) {
        next.h = Math.max(MIN_H, next.h + d);
        hy = c;
        break;
      }
    }
  } else if (handle.includes("n")) {
    const edge = next.y;
    const bottom = bounds.y + bounds.h;
    for (const c of yCandidates) {
      const d = c - edge;
      if (Math.abs(d) <= SNAP_THRESHOLD_Y) {
        next.y = c;
        next.h = Math.max(MIN_H, bottom - c);
        hy = c;
        break;
      }
    }
  }

  return { box: normalizeBox(next), vx, hy };
}

function handleCursor(handle: Handle) {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    default:
      return "default";
  }
}

export function TemplateCanvasEditor({
  regions,
  onRegionsChange,
  marginPct,
  padPct,
  selectedIds,
  onSelect,
  viewMode,
  showGrid,
  snapEnabled,
  className,
  onTransformStart,
  slideBackgroundSrc,
}: TemplateCanvasEditorProps) {
  const designOnly = viewMode === "design";
  const slideIsRasterBase = Boolean(slideBackgroundSrc);
  const overlayOnRaster =
    slideIsRasterBase && !designOnly;
  const canvasRef = useRef<HTMLDivElement>(null);
  const regionsRef = useRef(regions);
  const startedTransformRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingRegionsRef = useRef<TemplateRegion[] | null>(null);

  useEffect(() => {
    regionsRef.current = regions;
  }, [regions]);

  const dragRef = useRef<DragMode | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [grabId, setGrabId] = useState<string | null>(null);
  const [alignLines, setAlignLines] = useState<{ vx?: number; hy?: number }>({});
  const [sizeHint, setSizeHint] = useState<string | null>(null);
  const [hintPosition, setHintPosition] = useState<{ x: number; y: number } | null>(null);

  const inset = useMemo(() => (marginPct + padPct) / 100, [marginPct, padPct]);
  const selectedRegions = useMemo(
    () => regions.filter((r) => selectedIds.includes(r.id)),
    [regions, selectedIds],
  );
  const selectedBounds = useMemo(() => boundsFor(selectedRegions), [selectedRegions]);

  const scheduleRegionsCommit = useCallback(
    (next: TemplateRegion[]) => {
      pendingRegionsRef.current = next;
      if (frameRef.current != null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const latest = pendingRegionsRef.current;
        if (!latest) return;
        pendingRegionsRef.current = null;
        regionsRef.current = latest;
        onRegionsChange(latest);
      });
    },
    [onRegionsChange],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const metrics = getCanvasMetrics(canvasRef.current);
      const dxRaw = (e.clientX - drag.sx) / metrics.width;
      const dyRaw = (e.clientY - drag.sy) / metrics.height;
      const disableSnap = e.ctrlKey || e.metaKey;
      const cur = regionsRef.current;

      if (drag.kind === "move") {
        let dx = dxRaw;
        let dy = dyRaw;
        if (e.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
          else dx = 0;
        }

        const moved = cur.map((r) => {
          if (!drag.ids.includes(r.id) || r.locked) return r;
          const origin = drag.origin.get(r.id)!;
          return {
            ...r,
            x: clamp(origin.x + dx, 0, 1 - r.w),
            y: clamp(origin.y + dy, 0, 1 - r.h),
          };
        });

        const movedSelection = moved.filter((r) => drag.ids.includes(r.id));
        const movedBounds = boundsFor(movedSelection);
        let finalRegions = moved;
        let vx: number | undefined;
        let hy: number | undefined;
        if (movedBounds) {
          const snapped = snapMoveBox(
            movedBounds,
            moved,
            new Set(drag.ids),
            inset,
            snapEnabled && !disableSnap,
          );
          vx = snapped.vx;
          hy = snapped.hy;
          if (snapped.box.x !== movedBounds.x || snapped.box.y !== movedBounds.y) {
            const shiftX = snapped.box.x - movedBounds.x;
            const shiftY = snapped.box.y - movedBounds.y;
            finalRegions = moved.map((r) =>
              drag.ids.includes(r.id) && !r.locked
                ? { ...r, x: clamp(r.x + shiftX, 0, 1 - r.w), y: clamp(r.y + shiftY, 0, 1 - r.h) }
                : r,
            );
          }
        }
        setAlignLines({ vx, hy });
        setSizeHint(null);
        setHintPosition(null);
        scheduleRegionsCommit(finalRegions);
        return;
      }

      const nextBox = nextBoxFromHandle(
        drag.bounds,
        drag.handle,
        dxRaw,
        dyRaw,
        drag.keepAspect || e.shiftKey,
        drag.fromCenter || e.altKey,
      );

      let snappedBox = nextBox;
      let vx: number | undefined;
      let hy: number | undefined;
      if (snapEnabled && !disableSnap) {
        const snapped = snapResizeBox(
          nextBox,
          drag.bounds,
          drag.handle,
          cur,
          new Set(drag.ids),
          inset,
          true,
        );
        snappedBox = snapped.box;
        vx = snapped.vx;
        hy = snapped.hy;
      } else {
        vx = undefined;
        hy = undefined;
      }

      const resized = applyFrameToSelection(
        cur,
        new Set(drag.ids),
        drag.bounds,
        snappedBox,
      );
      scheduleRegionsCommit(resized);
      setAlignLines({ vx, hy });
      setSizeHint(
        `${Math.round(snappedBox.w * CANVAS_WIDTH)}×${Math.round(snappedBox.h * CANVAS_HEIGHT)} px`,
      );
      setHintPosition({
        x: clamp((e.clientX - metrics.left + 14) / metrics.width, 0.02, 0.92),
        y: clamp((e.clientY - metrics.top - 10) / metrics.height, 0.04, 0.94),
      });
    }

    function onUp() {
      dragRef.current = null;
      startedTransformRef.current = false;
      setDragging(false);
      setGrabId(null);
      setAlignLines({});
      setSizeHint(null);
      setHintPosition(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [inset, scheduleRegionsCommit, snapEnabled]);

  const beginTransform = useCallback(() => {
    if (startedTransformRef.current) return;
    startedTransformRef.current = true;
    onTransformStart?.();
  }, [onTransformStart]);

  const selectRegion = useCallback(
    (id: string, additive: boolean) => {
      if (!additive) {
        onSelect([id]);
        return;
      }
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onSelect(next);
    },
    [onSelect, selectedIds],
  );

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    onSelect([]);
    canvasRef.current?.focus();
  };

  const startMove = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    const region = regions.find((x) => x.id === id);
    if (!region || region.locked) return;
    canvasRef.current?.focus();

    const additive = e.metaKey || e.ctrlKey;
    if (additive) {
      selectRegion(id, true);
      return;
    }

    const ids = selectedIds.includes(id) ? selectedIds : [id];
    if (!selectedIds.includes(id)) onSelect([id]);

    const origin = new Map<string, Bounds>();
    for (const rid of ids) {
      const r = regions.find((x) => x.id === rid);
      if (r && !r.locked) origin.set(rid, { x: r.x, y: r.y, w: r.w, h: r.h });
    }
    if (origin.size === 0) return;

    beginTransform();
    dragRef.current = {
      kind: "move",
      ids: [...origin.keys()],
      sx: e.clientX,
      sy: e.clientY,
      origin,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    setGrabId(id);
  };

  const startResize = (
    e: ReactPointerEvent<HTMLButtonElement>,
    handle: Handle,
  ) => {
    e.stopPropagation();
    if (!selectedBounds) return;
    const ids = selectedRegions.filter((r) => !r.locked).map((r) => r.id);
    if (ids.length === 0) return;
    beginTransform();
    canvasRef.current?.focus();

    const keepAspectByDefault =
      ids.length === 1 &&
      selectedRegions[0] &&
      (selectedRegions[0].kind === "image" ||
        selectedRegions[0].kind === "chart" ||
        selectedRegions[0].kind === "icon") &&
      selectedRegions[0].aspectLocked !== false;

    const origin = new Map<string, Bounds>();
    for (const r of selectedRegions) {
      if (!r.locked) {
        origin.set(r.id, { x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
    dragRef.current = {
      kind: "resize",
      ids,
      sx: e.clientX,
      sy: e.clientY,
      origin,
      bounds: selectedBounds,
      handle,
      keepAspect: e.shiftKey || keepAspectByDefault,
      fromCenter: e.altKey,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const selectionViolation = useMemo(() => {
    if (slideIsRasterBase) return false;
    return selectedRegions.some(
      (r) =>
        r.x < inset ||
        r.y < inset ||
        r.x + r.w > 1 - inset ||
        r.y + r.h > 1 - inset,
    );
  }, [inset, selectedRegions, slideIsRasterBase]);

  const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const handleStyle = (bounds: Bounds, handle: Handle) => {
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    const pos = {
      nw: { left: `${bounds.x * 100}%`, top: `${bounds.y * 100}%` },
      n: { left: `${centerX * 100}%`, top: `${bounds.y * 100}%` },
      ne: { left: `${(bounds.x + bounds.w) * 100}%`, top: `${bounds.y * 100}%` },
      e: { left: `${(bounds.x + bounds.w) * 100}%`, top: `${centerY * 100}%` },
      se: { left: `${(bounds.x + bounds.w) * 100}%`, top: `${(bounds.y + bounds.h) * 100}%` },
      s: { left: `${centerX * 100}%`, top: `${(bounds.y + bounds.h) * 100}%` },
      sw: { left: `${bounds.x * 100}%`, top: `${(bounds.y + bounds.h) * 100}%` },
      w: { left: `${bounds.x * 100}%`, top: `${centerY * 100}%` },
    }[handle];
    return {
      ...pos,
      transform: "translate(-50%, -50%)",
      cursor: handleCursor(handle),
    };
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
        <span>
          {designOnly ? (
            <span className="text-foreground">
              Design view
              <span className="mx-1 font-normal text-[var(--border-subtle)]">·</span>
              <span className="font-normal text-[var(--muted)]">
                Original slide (locked)
              </span>
            </span>
          ) : (
            <>
              <span className="font-medium text-foreground">Metadata</span>
              <span className="mx-1 text-[var(--border-subtle)]">·</span>
              {overlayOnRaster ? (
                <span className="text-[var(--muted)]">
                  Regions are overlays on the slide — edit mapping rules, not design
                </span>
              ) : (
                <>
                  Drag, resize, or nudge with arrow keys
                  <span className="mx-1 text-[var(--border-subtle)]">·</span>
                  Cmd/Ctrl click multi-select
                </>
              )}
            </>
          )}
        </span>
        {sizeHint && !designOnly && !hintPosition ? (
          <span className="tabular-nums text-[var(--accent)]">{sizeHint}</span>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        <div
          ref={canvasRef}
          role="application"
          tabIndex={0}
          aria-label="Slide layout canvas"
          className={cn(
            "relative w-full max-w-[960px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-zinc-100 shadow-sm outline-none dark:bg-zinc-950",
            designOnly && "shadow-none",
          )}
          style={{ aspectRatio: "16 / 9" }}
          onPointerDown={onCanvasPointerDown}
        >
          {slideBackgroundSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element -- data URL from PPTX import */
            <img
              src={slideBackgroundSrc}
              alt=""
              className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain"
            />
          ) : (
            <div
              className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-zinc-100 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900"
              aria-hidden
            />
          )}
          {showGrid && !designOnly ? (
            <div
              className="pointer-events-none absolute inset-0 z-[2] opacity-[0.28] dark:opacity-20"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--border-subtle) 1px, transparent 1px), linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)",
                backgroundSize: `calc(100% / ${GRID_STEPS}) calc(100% / ${Math.round((GRID_STEPS * 9) / 16)})`,
              }}
            />
          ) : null}

          {!slideIsRasterBase && !designOnly ? (
            <>
              <div
                className="pointer-events-none absolute z-[2] rounded-lg border-2 border-dashed border-[var(--accent)]/35"
                style={{ inset: `${marginPct}%` }}
              />
              <div
                className="pointer-events-none absolute z-[2] rounded-md border border-blue-500/30 dark:border-blue-400/30"
                style={{
                  top: `${marginPct + padPct}%`,
                  left: `${marginPct + padPct}%`,
                  right: `${marginPct + padPct}%`,
                  bottom: `${marginPct + padPct}%`,
                }}
              />
            </>
          ) : null}

          {alignLines.vx != null ? (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-[4] w-px bg-[var(--accent)]/70"
              style={{ left: `${alignLines.vx * 100}%` }}
            />
          ) : null}
          {alignLines.hy != null ? (
            <div
              className="pointer-events-none absolute left-0 right-0 z-[4] h-px bg-[var(--accent)]/70"
              style={{ top: `${alignLines.hy * 100}%` }}
            />
          ) : null}

          {!designOnly
            ? regions.map((r) => {
                const selected = selectedIds.includes(r.id);
                const hover = hoverId === r.id;
                const grabbed = grabId === r.id && dragging;
                const Icon = regionIcon(r.kind);
                const safeZoneViolation =
                  !slideIsRasterBase &&
                  (r.x < inset ||
                    r.y < inset ||
                    r.x + r.w > 1 - inset ||
                    r.y + r.h > 1 - inset);

                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={-1}
                    className={cn(
                      "absolute z-[3] flex flex-col overflow-visible rounded-sm border-2 border-dashed text-left transition-[box-shadow,transform,opacity,border-color] duration-100",
                      overlayOnRaster
                        ? "border-[var(--accent)]/70 bg-[var(--accent)]/[0.04] shadow-none backdrop-blur-[0px]"
                        : cn(
                            r.kind === "text"
                              ? "border-[var(--foreground)]/20 bg-indigo-500/[0.07] dark:bg-indigo-400/[0.09]"
                              : "border-[var(--foreground)]/20 bg-amber-500/[0.08] dark:bg-amber-400/[0.08]",
                          ),
                      r.shapeVariant === "circle" && "rounded-[999px]",
                      r.locked && "opacity-75",
                      selected
                        ? overlayOnRaster
                          ? "z-20 border-[var(--accent)] bg-[var(--accent)]/[0.1] ring-2 ring-[var(--accent)]/50"
                          : "z-20 border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/20"
                        : overlayOnRaster
                          ? "z-10 hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.07]"
                          : "z-10 hover:border-[var(--foreground)]/35",
                      hover && !designOnly && "z-[15]",
                      grabbed && "scale-[1.005]",
                      safeZoneViolation &&
                        "border-amber-600/90 dark:border-amber-500/90",
                    )}
                    style={{
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      cursor: r.locked
                        ? "not-allowed"
                        : designOnly
                          ? "default"
                          : "grab",
                    }}
                    onPointerDown={(e) => {
                      if (designOnly || r.locked) return;
                      startMove(e, r.id);
                    }}
                    onMouseEnter={() => setHoverId(r.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onDoubleClick={() => {
                      if (!designOnly) onSelect([r.id]);
                    }}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute left-0 top-0 z-10 flex max-w-[calc(100%-4px)] items-center gap-0.5 rounded-br-md px-1 py-0.5",
                        overlayOnRaster
                          ? "bg-black/65 text-white dark:bg-black/75"
                          : "bg-[var(--surface-raised)]/95 text-foreground shadow-sm dark:bg-zinc-900/95",
                      )}
                    >
                      {r.locked ? (
                        <Lock
                          className={cn(
                            "size-2.5 shrink-0",
                            overlayOnRaster
                              ? "text-white/80"
                              : "text-[var(--muted)]",
                          )}
                          aria-hidden
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          "size-2.5 shrink-0",
                          overlayOnRaster
                            ? "text-white/85"
                            : "text-[var(--muted)]",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate text-[9px] font-semibold uppercase tracking-wide">
                        {r.label}
                      </span>
                    </div>
                  </div>
                );
              })
            : null}

          {selectedBounds && !designOnly ? (
            <>
              <div
                className={cn(
                  "pointer-events-none absolute z-30 rounded-sm border-2 transition-colors",
                  overlayOnRaster ? "border-dashed" : "border-solid",
                  selectionViolation
                    ? "border-amber-500/90"
                    : "border-[var(--accent)]",
                )}
                style={{
                  left: `${selectedBounds.x * 100}%`,
                  top: `${selectedBounds.y * 100}%`,
                  width: `${selectedBounds.w * 100}%`,
                  height: `${selectedBounds.h * 100}%`,
                }}
              />
              {handles.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  aria-label={`Resize selection ${handle}`}
                  className="absolute z-40 size-3 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-sm hover:bg-[var(--surface-inset)]"
                  style={handleStyle(selectedBounds, handle)}
                  onPointerDown={(e) => startResize(e, handle)}
                />
              ))}
            </>
          ) : null}

          {sizeHint && hintPosition ? (
            <div
              className="pointer-events-none absolute z-50 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-medium tabular-nums text-foreground shadow-sm"
              style={{
                left: `${hintPosition.x * 100}%`,
                top: `${hintPosition.y * 100}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              {sizeHint}
            </div>
          ) : null}
        </div>
      </div>

      {designOnly ? (
        <p className="px-1 text-[11px] leading-snug text-[var(--muted)]">
          <span className="font-medium text-foreground">Tip:</span> Switch to{" "}
          <span className="text-foreground">Metadata</span> to place and adjust
          region overlays. Press <kbd className="rounded border border-[var(--border-subtle)] px-1">P</kbd>{" "}
          to toggle.
        </p>
      ) : (
        <p className="px-1 text-[11px] leading-snug text-[var(--muted)]">
          <span className="font-medium text-foreground">Hints:</span>{" "}
          {overlayOnRaster ? (
            <>
              Boxes mark content fields only — the slide image is unchanged.
              Shift+drag axis lock · Shift resize keeps aspect · Alt resize from
              center · Cmd/Ctrl disables snap.
            </>
          ) : (
            <>
              Shift while dragging locks movement to one axis. Shift while
              resizing preserves aspect. Option/Alt resizes from center. Cmd/Ctrl
              temporarily disables snap.
            </>
          )}
        </p>
      )}
    </div>
  );
}

export function createRegion(kind: RegionKind, label: string): TemplateRegion {
  const id = `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const base: TemplateRegion = {
    id,
    label,
    kind,
    x: 0.35,
    y: 0.38,
    w: kind === "text" ? 0.42 : 0.22,
    h: kind === "text" ? 0.18 : 0.22,
    maxChars: kind === "text" ? 240 : 0,
  };
  if (kind === "shape") base.shapeVariant = "rect";
  if (kind === "image" || kind === "chart" || kind === "icon") {
    base.aspectLocked = true;
    base.imageFit = "cover";
  }
  if (kind === "text") {
    base.textAlign = "start";
    base.overflow = "ellipsis";
  }
  return base;
}
