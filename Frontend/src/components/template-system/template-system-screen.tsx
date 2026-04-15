"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ChangeEvent,
} from "react";
import {
  AlignCenterHorizontal,
  AlignLeft,
  AlignRight,
  BarChart3,
  Check,
  ChevronRight,
  Grid3x3,
  Image as ImageIcon,
  Magnet,
  Redo2,
  Shapes,
  Sparkles,
  Square,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import type { CompanyTemplate } from "./company-types";
import { parseTemplateDefinitionsFromJson } from "./template-import-utils";
import { SlideLayoutThumb } from "./template-slide-thumbnail";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TemplateCanvasEditor,
  createRegion,
} from "./template-canvas-editor";
import type {
  AiSuggestion,
  ContentDensity,
  LayoutRule,
  RegionKind,
  SlideTemplateDefinition,
  TemplateRegion,
} from "./types";

const TEMPLATE_TYPES = [
  "Title slide",
  "Bullet slide",
  "Data slide",
  "Comparison slide",
  "Section divider",
  "Closing slide",
] as const;

const USE_CASES = [
  "Title",
  "Content",
  "Comparison",
  "Data",
  "Agenda",
  "Closing",
] as const;

const DESIGN_TAG_OPTIONS = [
  "formal",
  "modern",
  "minimal",
  "corporate",
  "playful",
  "technical",
] as const;

const ELEMENT_OPTIONS = [
  "text",
  "image",
  "chart",
  "icon",
  "table",
] as const;

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function cloneSlideDefinitions(
  defs: SlideTemplateDefinition[],
): SlideTemplateDefinition[] {
  return defs.map((t) => ({
    ...t,
    regions: t.regions.map((r) => ({ ...r })),
    designTags: [...t.designTags],
    allowedElements: [...t.allowedElements],
  }));
}

function cloneRegions(rs: TemplateRegion[]): TemplateRegion[] {
  return rs.map((r) => ({ ...r }));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

function boundsForRegions(regions: TemplateRegion[]) {
  if (regions.length === 0) return null;
  const minX = Math.min(...regions.map((r) => r.x));
  const minY = Math.min(...regions.map((r) => r.y));
  const maxX = Math.max(...regions.map((r) => r.x + r.w));
  const maxY = Math.max(...regions.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function applyFrameToRegions(
  regions: TemplateRegion[],
  ids: Set<string>,
  from: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number; w: number; h: number },
) {
  const fromW = Math.max(from.w, 0.0001);
  const fromH = Math.max(from.h, 0.0001);
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
    next.w = Math.max(0.01, next.w);
    next.h = Math.max(0.01, next.h);
    next.x = clamp(next.x, 0, 1 - next.w);
    next.y = clamp(next.y, 0, 1 - next.h);
    return next;
  });
}

function StatusPill({ status }: { status: SlideTemplateDefinition["status"] }) {
  const isOk = status === "processed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        isOk
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-400",
      )}
    >
      {isOk ? "Processed" : "Needs review"}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-inset)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-[11px] tabular-nums text-[var(--muted)]">
        {pct}%
      </span>
    </div>
  );
}

export type TemplateCustomizeWorkspaceProps = {
  initialCompany: CompanyTemplate;
  onBack: () => void;
  /** Merges the current canvas back into the library (local) when leaving. */
  onPersistCompany?: (company: CompanyTemplate) => void;
};

export function TemplateCustomizeWorkspace({
  initialCompany,
  onBack,
  onPersistCompany,
}: TemplateCustomizeWorkspaceProps) {
  const [customizeReady, setCustomizeReady] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  const seed = useMemo(
    () => cloneSlideDefinitions(initialCompany.slideTemplates),
    [initialCompany],
  );

  const [templates, setTemplates] =
    useState<SlideTemplateDefinition[]>(seed);
  const [activeId, setActiveId] = useState(() => seed[0]?.id ?? "");
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>(() => {
    const id = seed[0]?.regions[0]?.id;
    return id ? [id] : [];
  });
  const [showCanvasGrid, setShowCanvasGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [canvasViewMode, setCanvasViewMode] = useState<"design" | "metadata">(
    "metadata",
  );
  const [historyPast, setHistoryPast] = useState<TemplateRegion[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<TemplateRegion[][]>([]);
  const templatesRef = useRef(templates);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestionEdits, setSuggestionEdits] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  /* eslint-disable react-hooks/set-state-in-effect -- reset workspace when switching template pack */
  useEffect(() => {
    const next = cloneSlideDefinitions(initialCompany.slideTemplates);
    setTemplates(next);
    const first = next[0];
    if (first) {
      setActiveId(first.id);
      setSelectedRegionIds(
        first.regions[0]?.id ? [first.regions[0].id] : [],
      );
    }
    setCustomizeReady(false);
    const tid = window.setTimeout(() => setCustomizeReady(true), 220);
    return () => clearTimeout(tid);
  }, [initialCompany]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mergeImportedDefinitions = useCallback(
    (defs: SlideTemplateDefinition[]) => {
      if (!defs.length) return;
      const clone = cloneSlideDefinitions(defs);
      setTemplates((prev) => {
        const next = [...prev];
        for (const d of clone) {
          const i = next.findIndex((t) => t.id === d.id);
          if (i >= 0) next[i] = d;
          else next.push(d);
        }
        return next;
      });
      const first = clone[0]!;
      setActiveId(first.id);
      setSelectedRegionIds(
        first.regions[0]?.id ? [first.regions[0].id] : [],
      );
    },
    [],
  );

  const onCustomizeJsonImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const defs = parseTemplateDefinitionsFromJson(parsed);
          if (!defs?.length) {
            window.alert(
              "Could not read slide templates from this file. Check the schema.",
            );
            return;
          }
          mergeImportedDefinitions(defs);
        } catch {
          window.alert("Invalid JSON file.");
        }
      };
      reader.readAsText(f);
    },
    [mergeImportedDefinitions],
  );

  const active = useMemo(() => {
    const t =
      templates.find((x) => x.id === activeId) ?? templates[0] ?? null;
    if (!t) {
      throw new Error("Template pack has no slide definitions.");
    }
    return t;
  }, [templates, activeId]);

  const updateActive = useCallback(
    (patch: Partial<SlideTemplateDefinition>) => {
      setTemplates((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, ...patch } : t)),
      );
    },
    [activeId],
  );

  const updateRegion = useCallback(
    (regionId: string, patch: Partial<TemplateRegion>) => {
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== activeId) return t;
          return {
            ...t,
            regions: t.regions.map((r) =>
              r.id === regionId ? { ...r, ...patch } : r,
            ),
          };
        }),
      );
    },
    [activeId],
  );

  const selectedRegion =
    selectedRegionIds.length === 1
      ? active.regions.find((r) => r.id === selectedRegionIds[0])
      : undefined;
  const selectedRegions = useMemo(
    () => active.regions.filter((r) => selectedRegionIds.includes(r.id)),
    [active.regions, selectedRegionIds],
  );
  const selectedBounds = useMemo(
    () => boundsForRegions(selectedRegions),
    [selectedRegions],
  );
  const selectedBoundsPx = useMemo(() => {
    if (!selectedBounds) return null;
    return {
      x: Math.round(selectedBounds.x * CANVAS_WIDTH),
      y: Math.round(selectedBounds.y * CANVAS_HEIGHT),
      w: Math.round(selectedBounds.w * CANVAS_WIDTH),
      h: Math.round(selectedBounds.h * CANVAS_HEIGHT),
    };
  }, [selectedBounds]);

  const handleRegionsChange = useCallback(
    (next: TemplateRegion[]) => {
      setTemplates((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, regions: next } : t)),
      );
    },
    [activeId],
  );

  const onTransformStart = useCallback(() => {
    const cur = templatesRef.current.find((t) => t.id === activeId)?.regions;
    if (!cur) return;
    setHistoryPast((p) => {
      const snap = cloneRegions(cur);
      const tail = p[p.length - 1];
      if (tail && JSON.stringify(tail) === JSON.stringify(snap)) return p;
      return [...p, snap].slice(-40);
    });
    setHistoryFuture([]);
  }, [activeId]);

  const undoCanvas = useCallback(() => {
    setHistoryPast((p) => {
      if (p.length === 0) return p;
      const restore = p[p.length - 1]!;
      const prevSnap = templatesRef.current.find((t) => t.id === activeId)
        ?.regions;
      if (prevSnap) {
        setHistoryFuture((f) => [...f, cloneRegions(prevSnap)].slice(-40));
      }
      setTemplates((tm) =>
        tm.map((t) =>
          t.id === activeId ? { ...t, regions: cloneRegions(restore) } : t,
        ),
      );
      return p.slice(0, -1);
    });
  }, [activeId]);

  const redoCanvas = useCallback(() => {
    setHistoryFuture((f) => {
      if (f.length === 0) return f;
      const restore = f[f.length - 1]!;
      const prevSnap = templatesRef.current.find((t) => t.id === activeId)
        ?.regions;
      if (prevSnap) {
        setHistoryPast((p) => [...p, cloneRegions(prevSnap)].slice(-40));
      }
      setTemplates((tm) =>
        tm.map((t) =>
          t.id === activeId ? { ...t, regions: cloneRegions(restore) } : t,
        ),
      );
      return f.slice(0, -1);
    });
  }, [activeId]);

  const addCanvasRegion = useCallback(
    (kind: RegionKind) => {
      onTransformStart();
      const label =
        kind === "text"
          ? "Text"
          : kind === "image"
            ? "Image"
            : kind === "shape"
              ? "Shape"
              : kind === "chart"
                ? "Chart"
                : "Icon";
      const created = createRegion(kind, label);
      const next = [...active.regions, created];
      handleRegionsChange(next);
      setSelectedRegionIds([created.id]);
    },
    [active.regions, handleRegionsChange, onTransformStart],
  );

  const alignSelected = useCallback(
    (mode: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
      if (selectedRegionIds.length === 0) return;
      const marginPct = Math.min(20, active.spacing.margin / 6.5);
      const padPct = Math.min(14, active.spacing.padding / 5.5);
      const inset = (marginPct + padPct) / 100;
      const safeInner = 1 - 2 * inset;
      onTransformStart();
      const idSet = new Set(selectedRegionIds);
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== activeId) return t;
          return {
            ...t,
            regions: t.regions.map((r) => {
              if (!idSet.has(r.id) || r.locked) return r;
              let x = r.x;
              let y = r.y;
              if (mode === "left") x = inset;
              if (mode === "right") x = 1 - inset - r.w;
              if (mode === "center")
                x = inset + Math.max(0, (safeInner - r.w) / 2);
              if (mode === "top") y = inset;
              if (mode === "bottom") y = 1 - inset - r.h;
              if (mode === "middle")
                y = inset + Math.max(0, (safeInner - r.h) / 2);
              x = Math.min(Math.max(x, inset), 1 - inset - r.w);
              y = Math.min(Math.max(y, inset), 1 - inset - r.h);
              return { ...r, x, y };
            }),
          };
        }),
      );
    },
    [
      active.spacing.margin,
      active.spacing.padding,
      activeId,
      onTransformStart,
      selectedRegionIds,
    ],
  );

  const distributeSelected = useCallback(
    (axis: "horizontal" | "vertical") => {
      if (selectedRegionIds.length < 3) return;
      const selected = active.regions.filter(
        (r) => selectedRegionIds.includes(r.id) && !r.locked,
      );
      const bounds = boundsForRegions(selected);
      if (!bounds || selected.length < 3) return;
      const ordered = [...selected].sort((a, b) =>
        axis === "horizontal" ? a.x - b.x : a.y - b.y,
      );
      const totalSize = ordered.reduce(
        (sum, r) => sum + (axis === "horizontal" ? r.w : r.h),
        0,
      );
      const free =
        (axis === "horizontal" ? bounds.w : bounds.h) - totalSize;
      const gap = free / (ordered.length - 1);
      onTransformStart();
      let cursor = axis === "horizontal" ? bounds.x : bounds.y;
      const placement = new Map<string, number>();
      for (const r of ordered) {
        placement.set(r.id, cursor);
        cursor += (axis === "horizontal" ? r.w : r.h) + gap;
      }
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== activeId) return t;
          return {
            ...t,
            regions: t.regions.map((r) =>
              placement.has(r.id)
                ? {
                    ...r,
                    ...(axis === "horizontal"
                      ? { x: placement.get(r.id)! }
                      : { y: placement.get(r.id)! }),
                  }
                : r,
            ),
          };
        }),
      );
    },
    [active.regions, activeId, onTransformStart, selectedRegionIds],
  );

  const applySelectedBoundsPx = useCallback(
    (
      patch: Partial<{ x: number; y: number; w: number; h: number }>,
    ) => {
      if (!selectedBounds) return;
      const nextPx = {
        x: Math.round(selectedBounds.x * CANVAS_WIDTH),
        y: Math.round(selectedBounds.y * CANVAS_HEIGHT),
        w: Math.round(selectedBounds.w * CANVAS_WIDTH),
        h: Math.round(selectedBounds.h * CANVAS_HEIGHT),
        ...patch,
      };
      const nextNorm = {
        x: clamp(nextPx.x / CANVAS_WIDTH, 0, 1),
        y: clamp(nextPx.y / CANVAS_HEIGHT, 0, 1),
        w: clamp(nextPx.w / CANVAS_WIDTH, 0.01, 1),
        h: clamp(nextPx.h / CANVAS_HEIGHT, 0.01, 1),
      };
      nextNorm.x = clamp(nextNorm.x, 0, 1 - nextNorm.w);
      nextNorm.y = clamp(nextNorm.y, 0, 1 - nextNorm.h);
      onTransformStart();
      handleRegionsChange(
        applyFrameToRegions(
          active.regions,
          new Set(selectedRegionIds),
          selectedBounds,
          nextNorm,
        ),
      );
    },
    [
      active.regions,
      handleRegionsChange,
      onTransformStart,
      selectedBounds,
      selectedRegionIds,
    ],
  );

  const nudgeSelection = useCallback(
    (dxPx: number, dyPx: number) => {
      if (selectedRegionIds.length === 0) return;
      onTransformStart();
      const dx = dxPx / CANVAS_WIDTH;
      const dy = dyPx / CANVAS_HEIGHT;
      handleRegionsChange(
        active.regions.map((r) => {
          if (!selectedRegionIds.includes(r.id) || r.locked) return r;
          return {
            ...r,
            x: clamp(r.x + dx, 0, 1 - r.w),
            y: clamp(r.y + dy, 0, 1 - r.h),
          };
        }),
      );
    },
    [active.regions, handleRegionsChange, onTransformStart, selectedRegionIds],
  );

  const removeSelectedRegion = useCallback(() => {
    if (selectedRegionIds.length === 0) return;
    const removableIds = new Set(
      active.regions
        .filter((x) => selectedRegionIds.includes(x.id) && !x.locked)
        .map((x) => x.id),
    );
    if (removableIds.size === 0) return;
    onTransformStart();
    const remaining = active.regions.filter((x) => !removableIds.has(x.id));
    handleRegionsChange(remaining);
    setSelectedRegionIds(remaining[0]?.id ? [remaining[0].id] : []);
  }, [
    active.regions,
    handleRegionsChange,
    onTransformStart,
    selectedRegionIds,
  ]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoCanvas();
        else undoCanvas();
        return;
      }

      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoCanvas();
        return;
      }

      if (selectedRegionIds.length > 0 && e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (e.altKey && e.shiftKey) {
          if (e.key === "ArrowLeft") alignSelected("left");
          if (e.key === "ArrowRight") alignSelected("right");
          if (e.key === "ArrowUp") alignSelected("top");
          if (e.key === "ArrowDown") alignSelected("bottom");
          return;
        }
        const step = e.altKey ? 0.5 : e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") nudgeSelection(-step, 0);
        if (e.key === "ArrowRight") nudgeSelection(step, 0);
        if (e.key === "ArrowUp") nudgeSelection(0, -step);
        if (e.key === "ArrowDown") nudgeSelection(0, step);
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedRegionIds.length > 0) {
          e.preventDefault();
          removeSelectedRegion();
        }
        return;
      }

      if (e.key === "Escape") {
        if (selectedRegionIds.length > 0) {
          e.preventDefault();
          setSelectedRegionIds([]);
        }
        return;
      }

      if (mod || e.altKey) {
        if (e.altKey && e.shiftKey) {
          const key = e.key.toLowerCase();
          if (key === "c") {
            e.preventDefault();
            alignSelected("center");
            return;
          }
          if (key === "m") {
            e.preventDefault();
            alignSelected("middle");
            return;
          }
          if (key === "h" && selectedRegionIds.length >= 3) {
            e.preventDefault();
            distributeSelected("horizontal");
            return;
          }
          if (key === "v" && selectedRegionIds.length >= 3) {
            e.preventDefault();
            distributeSelected("vertical");
            return;
          }
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "t") {
        e.preventDefault();
        addCanvasRegion("text");
        return;
      }
      if (key === "i") {
        e.preventDefault();
        addCanvasRegion("image");
        return;
      }
      if (key === "r") {
        e.preventDefault();
        addCanvasRegion("shape");
        return;
      }
      if (key === "c") {
        e.preventDefault();
        addCanvasRegion("chart");
        return;
      }
      if (key === "k") {
        e.preventDefault();
        addCanvasRegion("icon");
        return;
      }
      if (key === "g") {
        e.preventDefault();
        setShowCanvasGrid((v) => !v);
        return;
      }
      if (key === "s") {
        e.preventDefault();
        setSnapEnabled((v) => !v);
        return;
      }
      if (key === "p") {
        e.preventDefault();
        setCanvasViewMode((v) => (v === "design" ? "metadata" : "design"));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    addCanvasRegion,
    alignSelected,
    distributeSelected,
    nudgeSelection,
    redoCanvas,
    removeSelectedRegion,
    selectedRegionIds,
    undoCanvas,
  ]);

  const templateTypeOptions = useMemo(() => {
    const s = new Set<string>([...TEMPLATE_TYPES, active.templateType]);
    return [...s];
  }, [active.templateType]);

  const runAutoDetect = () => {
    setAiSuggestions([]);
    setSuggestionEdits({});
  };

  const applySuggestion = (s: AiSuggestion) => {
    const val = suggestionEdits[s.id] ?? s.value;
    if (s.field === "templateType") {
      updateActive({ templateType: val });
    } else if (s.field === "density") {
      const d = val.toLowerCase() as ContentDensity;
      if (d === "low" || d === "medium" || d === "high") {
        updateActive({ density: d });
      }
    } else if (s.field === "designTags") {
      updateActive({
        designTags: val.split(",").map((x) => x.trim()).filter(Boolean),
      });
    }
    setAiSuggestions((prev) => prev.filter((x) => x.id !== s.id));
  };

  const exportJson = () => {
    const payload = {
      slideTemplates: cloneSlideDefinitions(templates),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName =
      initialCompany.name.replace(/[/\\?%*:|"<>]/g, "-").trim() ||
      "template-pack";
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Map px metadata to % of slide for guides (approx. 1080p vertical scale). */
  const marginPct = Math.min(20, active.spacing.margin / 6.5);
  const padPct = Math.min(14, active.spacing.padding / 5.5);

  return (
    <div className="shell-main-fade flex h-full min-h-0 flex-col bg-[var(--background)]">
      <nav
        className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5 text-xs"
        aria-label="Breadcrumb"
      >
        <button
          type="button"
          onClick={() => {
            onPersistCompany?.({
              ...initialCompany,
              slideTemplates: cloneSlideDefinitions(templates),
            });
            onBack();
          }}
          className="rounded text-[var(--muted)] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          All Templates
        </button>
        <ChevronRight className="size-3.5 shrink-0 text-[var(--muted)]" />
        <span className="min-w-0 truncate font-medium text-foreground">
          {initialCompany.name}
        </span>
        <ChevronRight className="size-3.5 shrink-0 text-[var(--muted)]" />
        <span className="min-w-0 truncate text-[var(--muted)]">
          Slide layouts · {active.name}
        </span>
      </nav>
      {!customizeReady ? (
        <div className="flex min-h-0 flex-1 animate-pulse flex-col">
          <div className="h-12 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-inset)]" />
          <div className="flex min-h-0 min-w-0 flex-1 gap-2 p-2">
            <div className="w-[260px] shrink-0 rounded-xl bg-[var(--surface-inset)]" />
            <div className="min-h-0 min-w-0 flex-1 rounded-xl bg-[var(--surface-inset)]" />
            <div className="hidden w-[min(380px,32vw)] min-w-[300px] shrink-0 rounded-xl bg-[var(--surface-inset)] lg:block" />
          </div>
        </div>
      ) : (
        <>
          <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight">
            Template setup
          </h1>
          <p className="truncate text-xs text-[var(--muted)]">
            {initialCompany.name} — refine regions and metadata per layout.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onCustomizeJsonImport}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Upload className="size-3.5" strokeWidth={2} />
            Import
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
          >
            Save as JSON
          </button>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto">
        {/* LEFT — template list */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="border-b border-[var(--border-subtle)] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Slide layouts
            </p>
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {templates.map((t) => (
              <li key={t.id} className="mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(t.id);
                    setSelectedRegionIds(
                      t.regions[0]?.id ? [t.regions[0].id] : [],
                    );
                  }}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                    t.id === activeId
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/30"
                      : "border-[var(--border-subtle)] bg-[var(--background)] hover:border-[var(--muted)]/40",
                  )}
                >
                  <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-inset)]">
                    <SlideLayoutThumb slide={t} />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">
                      {t.name}
                    </span>
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-[var(--muted)]",
                        t.id === activeId && "text-[var(--accent)]",
                      )}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[var(--surface-inset)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                      {t.useCase}
                    </span>
                    <StatusPill status={t.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* CENTER — interactive canvas editor */}
        <section className="relative flex min-w-0 flex-1 flex-col bg-[var(--surface-inset)]/40">
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2">
            <span className="mr-1 hidden text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] sm:inline">
              Add
            </span>
            <button
              type="button"
              onClick={() => addCanvasRegion("text")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
            >
              <Type className="size-3.5" />
              Text
            </button>
            <button
              type="button"
              onClick={() => addCanvasRegion("image")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
            >
              <ImageIcon className="size-3.5" />
              Image
            </button>
            <button
              type="button"
              onClick={() => addCanvasRegion("shape")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
            >
              <Square className="size-3.5" />
              Shape
            </button>
            <button
              type="button"
              onClick={() => addCanvasRegion("chart")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
            >
              <BarChart3 className="size-3.5" />
              Chart
            </button>
            <button
              type="button"
              onClick={() => addCanvasRegion("icon")}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
            >
              <Shapes className="size-3.5" />
              Icon
            </button>

            <span className="mx-1 hidden h-5 w-px bg-[var(--border-subtle)] sm:inline" />
            <button
              type="button"
              onClick={undoCanvas}
              disabled={historyPast.length === 0}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40"
            >
              <Undo2 className="size-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={redoCanvas}
              disabled={historyFuture.length === 0}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40"
            >
              <Redo2 className="size-3.5" />
              Redo
            </button>

            <span className="mx-1 hidden h-5 w-px bg-[var(--border-subtle)] sm:inline" />
            <button
              type="button"
              onClick={() => setShowCanvasGrid((v) => !v)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium",
                showCanvasGrid
                  ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
              )}
            >
              <Grid3x3 className="size-3.5" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setSnapEnabled((v) => !v)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium",
                snapEnabled
                  ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
              )}
            >
              <Magnet className="size-3.5" />
              Snap
            </button>
            <div
              className="inline-flex h-8 shrink-0 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-0.5"
              role="group"
              aria-label="Canvas view"
            >
              <button
                type="button"
                onClick={() => setCanvasViewMode("design")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  canvasViewMode === "design"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-foreground",
                )}
              >
                Design
              </button>
              <button
                type="button"
                onClick={() => setCanvasViewMode("metadata")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  canvasViewMode === "metadata"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-foreground",
                )}
              >
                Metadata
              </button>
            </div>

            <span className="mx-1 hidden h-5 w-px bg-[var(--border-subtle)] lg:inline" />
            <button
              type="button"
              onClick={() => alignSelected("left")}
              disabled={selectedRegionIds.length === 0}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 hover:bg-[var(--surface-inset)] disabled:opacity-40 lg:inline-flex"
            >
              <AlignLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => alignSelected("center")}
              disabled={selectedRegionIds.length === 0}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 hover:bg-[var(--surface-inset)] disabled:opacity-40 lg:inline-flex"
            >
              <AlignCenterHorizontal className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => alignSelected("right")}
              disabled={selectedRegionIds.length === 0}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 hover:bg-[var(--surface-inset)] disabled:opacity-40 lg:inline-flex"
            >
              <AlignRight className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => alignSelected("top")}
              disabled={selectedRegionIds.length === 0}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40 xl:inline-flex"
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => alignSelected("middle")}
              disabled={selectedRegionIds.length === 0}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40 xl:inline-flex"
            >
              Middle
            </button>
            <button
              type="button"
              onClick={() => alignSelected("bottom")}
              disabled={selectedRegionIds.length === 0}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40 xl:inline-flex"
            >
              Bottom
            </button>
            <button
              type="button"
              onClick={() => distributeSelected("horizontal")}
              disabled={selectedRegionIds.length < 3}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40 xl:inline-flex"
            >
              Dist H
            </button>
            <button
              type="button"
              onClick={() => distributeSelected("vertical")}
              disabled={selectedRegionIds.length < 3}
              className="hidden h-8 items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40 xl:inline-flex"
            >
              Dist V
            </button>
          </div>

          <TemplateCanvasEditor
            regions={active.regions}
            onRegionsChange={handleRegionsChange}
            marginPct={marginPct}
            padPct={padPct}
            selectedIds={selectedRegionIds}
            onSelect={setSelectedRegionIds}
            viewMode={canvasViewMode}
            showGrid={showCanvasGrid}
            snapEnabled={snapEnabled}
            onTransformStart={onTransformStart}
            slideBackgroundSrc={active.slidePreviewDataUrl ?? null}
            className="min-h-0 flex-1 px-3 pb-3 pt-1"
          />
        </section>

        {/* RIGHT — metadata & AI */}
        <aside className="flex w-[min(380px,32vw)] min-w-[300px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="flex h-11 shrink-0 items-center border-b border-[var(--border-subtle)] px-4">
            <h2 className="text-sm font-semibold tracking-tight">Metadata</h2>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="space-y-4 p-4">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Template type
                </label>
                <select
                  value={active.templateType}
                  onChange={(e) => updateActive({ templateType: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                >
                  {templateTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Use case tag
                </label>
                <select
                  value={active.useCase}
                  onChange={(e) => updateActive({ useCase: e.target.value })}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                >
                  {USE_CASES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Status
                </label>
                <div className="mt-1.5 flex gap-2">
                  {(
                    [
                      ["processed", "Processed"],
                      ["needs_review", "Needs review"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => updateActive({ status: val })}
                      className={cn(
                        "h-9 flex-1 rounded-xl border text-xs font-medium transition-colors",
                        active.status === val
                          ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                          : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Layout rules
                </label>
                <div className="mt-1.5 flex gap-2">
                  {(
                    [
                      ["fixed", "Fixed"],
                      ["flexible", "Flexible"],
                    ] as const satisfies [LayoutRule, string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => updateActive({ layoutRule: val })}
                      className={cn(
                        "h-9 flex-1 rounded-xl border text-xs font-medium transition-colors",
                        active.layoutRule === val
                          ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                          : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Padding (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={active.spacing.padding}
                    onChange={(e) =>
                      updateActive({
                        spacing: {
                          ...active.spacing,
                          padding: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-sm tabular-nums focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Margins (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={active.spacing.margin}
                    onChange={(e) =>
                      updateActive({
                        spacing: {
                          ...active.spacing,
                          margin: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-sm tabular-nums focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Design language tags
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DESIGN_TAG_OPTIONS.map((tag) => {
                    const on = active.designTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          updateActive({
                            designTags: on
                              ? active.designTags.filter((x) => x !== tag)
                              : [...active.designTags, tag],
                          })
                        }
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                          on
                            ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                            : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Content density
                </label>
                <div className="mt-1.5 flex gap-2">
                  {(
                    [
                      ["low", "Low"],
                      ["medium", "Medium"],
                      ["high", "High"],
                    ] as const satisfies [ContentDensity, string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => updateActive({ density: val })}
                      className={cn(
                        "h-9 flex-1 rounded-xl border text-xs font-medium transition-colors",
                        active.density === val
                          ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                          : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Allowed elements
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ELEMENT_OPTIONS.map((el) => {
                    const on = active.allowedElements.includes(el);
                    return (
                      <button
                        key={el}
                        type="button"
                        onClick={() =>
                          updateActive({
                            allowedElements: on
                              ? active.allowedElements.filter((x) => x !== el)
                              : [...active.allowedElements, el],
                          })
                        }
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                          on
                            ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
                            : "border-[var(--border-subtle)] bg-[var(--background)] hover:bg-[var(--surface-inset)]",
                        )}
                      >
                        {el}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Canvas selection — auto-syncs with interactive editor */}
            <div className="border-t border-[var(--border-subtle)] p-4">
              <h3 className="text-xs font-semibold tracking-tight text-foreground">
                Element properties
              </h3>
              {selectedRegionIds.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                  Select an element on the canvas or from the list below.
                  Drag to reposition, use any handle to resize, or nudge with
                  arrow keys for precision.
                </p>
              ) : selectedRegionIds.length > 1 ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs text-[var(--muted)]">
                      {selectedRegionIds.length} elements selected.
                    </p>
                    {selectedBoundsPx ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(
                          [
                            ["X", "x"],
                            ["Y", "y"],
                            ["Width", "w"],
                            ["Height", "h"],
                          ] as const
                        ).map(([label, key]) => (
                          <label key={key} className="block">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                              {label}
                            </span>
                            <div className="relative mt-1.5">
                              <input
                                type="number"
                                min={key === "w" || key === "h" ? 1 : 0}
                                step={1}
                                value={selectedBoundsPx[key]}
                                onChange={(e) =>
                                  applySelectedBoundsPx({
                                    [key]: Number(e.target.value) || 0,
                                  })
                                }
                                className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 pr-8 text-sm tabular-nums focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] uppercase text-[var(--muted)]">
                                px
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => alignSelected("left")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Align left
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("center")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("right")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Align right
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("top")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Align top
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("middle")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Align middle
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("bottom")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Align bottom
                    </button>
                    <button
                      type="button"
                      disabled={selectedRegionIds.length < 3}
                      onClick={() => distributeSelected("horizontal")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40"
                    >
                      Dist. horizontal
                    </button>
                    <button
                      type="button"
                      disabled={selectedRegionIds.length < 3}
                      onClick={() => distributeSelected("vertical")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)] disabled:opacity-40"
                    >
                      Dist. vertical
                    </button>
                  </div>
                </div>
              ) : selectedRegion ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      Label
                    </label>
                    <input
                      type="text"
                      value={selectedRegion.label}
                      onChange={(e) =>
                        updateRegion(selectedRegion.id, {
                          label: e.target.value,
                        })
                      }
                      className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      className="rounded border-[var(--border-subtle)]"
                      checked={!!selectedRegion.locked}
                      onChange={(e) =>
                        updateRegion(selectedRegion.id, {
                          locked: e.target.checked,
                        })
                      }
                    />
                    Locked (no move / resize)
                  </label>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      Layout / Position
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          ["X", "x", CANVAS_WIDTH],
                          ["Y", "y", CANVAS_HEIGHT],
                          ["Width", "w", CANVAS_WIDTH],
                          ["Height", "h", CANVAS_HEIGHT],
                        ] as const
                      ).map(([label, key, scale]) => (
                        <label key={key} className="block">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                            {label}
                          </span>
                          <div className="relative mt-1.5">
                            <input
                              type="number"
                              min={key === "w" || key === "h" ? 1 : 0}
                              step={1}
                              value={Math.round(selectedRegion[key] * scale)}
                              onChange={(e) => {
                                const raw = Number(e.target.value) || 0;
                                const patch =
                                  key === "x"
                                    ? {
                                        x: clamp(
                                          raw / CANVAS_WIDTH,
                                          0,
                                          1 - selectedRegion.w,
                                        ),
                                      }
                                    : key === "y"
                                      ? {
                                          y: clamp(
                                            raw / CANVAS_HEIGHT,
                                            0,
                                            1 - selectedRegion.h,
                                          ),
                                        }
                                      : key === "w"
                                        ? {
                                            w: clamp(
                                              raw / CANVAS_WIDTH,
                                              0.01,
                                              1 - selectedRegion.x,
                                            ),
                                          }
                                        : {
                                            h: clamp(
                                              raw / CANVAS_HEIGHT,
                                              0.01,
                                              1 - selectedRegion.y,
                                            ),
                                          };
                                updateRegion(
                                  selectedRegion.id,
                                  patch as Partial<TemplateRegion>,
                                );
                              }}
                              className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 pr-8 text-sm tabular-nums focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] uppercase text-[var(--muted)]">
                              px
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => alignSelected("left")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("center")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("right")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Right
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("top")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Top
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("middle")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Middle
                    </button>
                    <button
                      type="button"
                      onClick={() => alignSelected("bottom")}
                      className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-[11px] font-medium hover:bg-[var(--surface-inset)]"
                    >
                      Bottom
                    </button>
                  </div>
                  {selectedRegion.kind === "text" ? (
                    <>
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                          Max characters
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={selectedRegion.maxChars}
                          onChange={(e) =>
                            updateRegion(selectedRegion.id, {
                              maxChars: Number(e.target.value) || 0,
                            })
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                          Text align
                        </label>
                        <select
                          value={selectedRegion.textAlign ?? "start"}
                          onChange={(e) =>
                            updateRegion(selectedRegion.id, {
                              textAlign: e.target.value as TemplateRegion["textAlign"],
                            })
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm"
                        >
                          <option value="start">Start</option>
                          <option value="center">Center</option>
                          <option value="end">End</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                          Overflow
                        </label>
                        <select
                          value={selectedRegion.overflow ?? "ellipsis"}
                          onChange={(e) =>
                            updateRegion(selectedRegion.id, {
                              overflow: e.target.value as TemplateRegion["overflow"],
                            })
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm"
                        >
                          <option value="ellipsis">Ellipsis</option>
                          <option value="clip">Clip</option>
                        </select>
                      </div>
                    </>
                  ) : null}
                  {(selectedRegion.kind === "image" ||
                    selectedRegion.kind === "chart" ||
                    selectedRegion.kind === "icon") && (
                    <>
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="rounded border-[var(--border-subtle)]"
                          checked={selectedRegion.aspectLocked !== false}
                          onChange={(e) =>
                            updateRegion(selectedRegion.id, {
                              aspectLocked: e.target.checked,
                            })
                          }
                        />
                        Lock aspect ratio when resizing
                      </label>
                      <div>
                        <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                          Image fit
                        </label>
                        <select
                          value={selectedRegion.imageFit ?? "cover"}
                          onChange={(e) =>
                            updateRegion(selectedRegion.id, {
                              imageFit: e.target.value as TemplateRegion["imageFit"],
                            })
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm"
                        >
                          <option value="cover">Cover</option>
                          <option value="contain">Contain</option>
                        </select>
                      </div>
                    </>
                  )}
                  {selectedRegion.kind === "shape" ? (
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        Shape
                      </label>
                      <select
                        value={selectedRegion.shapeVariant ?? "rect"}
                        onChange={(e) =>
                          updateRegion(selectedRegion.id, {
                            shapeVariant:
                              e.target.value === "circle" ? "circle" : "rect",
                          })
                        }
                        className="mt-1.5 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-sm"
                      >
                        <option value="rect">Rectangle</option>
                        <option value="circle">Circle</option>
                      </select>
                    </div>
                  ) : null}
                  {!selectedRegion.locked ? (
                    <button
                      type="button"
                      onClick={removeSelectedRegion}
                      className="w-full rounded-lg border border-red-500/40 py-2 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
                    >
                      Remove element
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Region mapping — inspect-style */}
            <div className="border-t border-[var(--border-subtle)] bg-[var(--background)]/50 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                All regions
              </p>
              <ul className="mt-2 space-y-2">
                {active.regions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRegionIds([r.id])}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors",
                        r.id === selectedRegionIds[0] &&
                          selectedRegionIds.length === 1
                          ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                          : selectedRegionIds.includes(r.id)
                            ? "border-[var(--accent)]/60 bg-[var(--accent-muted)]/50"
                            : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--muted)]/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{r.label}</span>
                        <span className="text-[10px] uppercase text-[var(--muted)]">
                          {r.kind}
                          {r.locked ? " · locked" : ""}
                        </span>
                      </div>
                      {r.kind === "text" ? (
                        <label className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                          <span className="shrink-0">Max chars</span>
                          <input
                            type="number"
                            min={0}
                            value={r.maxChars}
                            onChange={(e) =>
                              updateRegion(r.id, {
                                maxChars: Number(e.target.value) || 0,
                              })
                            }
                            onClick={(ev) => ev.stopPropagation()}
                            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-2 text-xs tabular-nums focus:border-[var(--accent)] focus:outline-none"
                          />
                        </label>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI assistance */}
            <div className="border-t border-[var(--border-subtle)] p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">AI assistance</h3>
                <Sparkles className="size-4 text-[var(--accent)]" />
              </div>
              <button
                type="button"
                onClick={runAutoDetect}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] py-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <Sparkles className="size-3.5" />
                Auto-detect template rules
              </button>
              {aiSuggestions.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {aiSuggestions.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                          {s.field}
                        </span>
                        <ConfidenceBar value={s.confidence} />
                      </div>
                      <input
                        type="text"
                        value={suggestionEdits[s.id] ?? s.value}
                        onChange={(e) =>
                          setSuggestionEdits((prev) => ({
                            ...prev,
                            [s.id]: e.target.value,
                          }))
                        }
                        className="mt-2 h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] py-2 text-xs font-medium text-white hover:opacity-90"
                      >
                        <Check className="size-3.5" />
                        Apply to metadata
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
        </>
      )}
    </div>
  );
}
