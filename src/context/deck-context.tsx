"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EditorSlide } from "@/components/editor/types";
import {
  computePreflightIssues,
  createBlankDeckDocument,
  createStarterOutlineDeck,
  editorSlideToContentPatch,
  isMappingOnlyPatch,
  newDeckId,
  refreshDerivedSlideFields,
} from "@/lib/deck/helpers";
import {
  buildSlideModelsFromContentRows,
  rebuildSlideModelsFromDeckSlides,
} from "@/lib/deck/slide-model-bridge";
import {
  replaceStructuredSectionForSlide,
  structuredContentForDeck,
} from "@/lib/deck/structured-deck-sync";
import { loadTemplateLibrary } from "@/components/template-system/template-library-storage";
import { syncDeckToHistory } from "@/lib/history/storage";
import { deckWithSlideModelsHydrated } from "@/lib/deck/hydrate-slide-models";
import { loadDeckFromStorage, saveDeckToStorage } from "@/lib/deck/storage";
import type { DeckDocument, DeckSlide, PreflightIssue } from "@/lib/deck/types";
import type { EntryMethod } from "@/components/content-wizard/types";
import type { SlideContent } from "@/components/content-wizard/types";

type WizardMeta = {
  entryMethod: EntryMethod;
  pasteText: string;
  aiPrompt: string;
  uploadLabel: string | null;
  wizardStep: 1 | 2;
};

type DeckContextValue = {
  deck: DeckDocument;
  dirty: boolean;
  lastSavedAt: number | null;
  preflight: PreflightIssue[];
  setDeckTitle: (title: string) => void;
  setWizardMeta: (partial: Partial<WizardMeta>) => void;
  /** Full replace (e.g. restructured outline). Clears editor canvas. */
  setDeckSlides: (slides: DeckSlide[]) => void;
  replaceSlidesFromPlainContent: (rows: SlideContent[]) => void;
  setActiveCompanyTemplate: (args: {
    id: string;
    name: string;
    allowedTemplateSlideIds: string[] | null;
  }) => void;
  updateDeckSlide: (id: string, patch: Partial<DeckSlide>) => void;
  pushEditorSlides: (editorSlides: EditorSlide[]) => void;
  recordCheckpoint: (label?: string) => void;
  newDeck: () => void;
  /** One empty slide; uses the active design system’s template pool when available. */
  loadStarterOutline: () => void;
  flushSave: () => void;
};

const DeckContext = createContext<DeckContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 500;

export function DeckProvider({ children }: { children: ReactNode }) {
  const [deck, setDeck] = useState<DeckDocument>(() => createBlankDeckDocument());
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = loadDeckFromStorage();
      if (stored) {
        const { deck: merged, changed } = deckWithSlideModelsHydrated(stored);
        if (changed) {
          const next = { ...merged, updatedAt: Date.now() };
          saveDeckToStorage(next);
          syncDeckToHistory(next);
          setDeck(next);
          setLastSavedAt(next.updatedAt);
        } else {
          setDeck(merged);
          setLastSavedAt(merged.updatedAt);
        }
      }
      setHydrated(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setDeck((d) => {
      const next = { ...d, updatedAt: Date.now() };
      saveDeckToStorage(next);
      syncDeckToHistory(next);
      return next;
    });
    setLastSavedAt(Date.now());
    setDirty(false);
  }, []);

  const scheduleSave = useCallback(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      setDeck((d) => {
        const next = { ...d, updatedAt: Date.now() };
        saveDeckToStorage(next);
        syncDeckToHistory(next);
        return next;
      });
      setLastSavedAt(Date.now());
      setDirty(false);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const setDeckTitle = useCallback(
    (title: string) => {
      setDeck((d) => ({ ...d, title: title.trim() || "Untitled deck" }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const setWizardMeta = useCallback(
    (partial: Partial<WizardMeta>) => {
      setDeck((d) => ({ ...d, ...partial }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const setDeckSlides = useCallback(
    (slides: DeckSlide[]) => {
      setDeck((d) => {
        const refreshed = slides.map(refreshDerivedSlideFields);
        return {
          ...d,
          slides: refreshed,
          editorSlides: null,
          slideModels: null,
          structuredContent: structuredContentForDeck(
            refreshed,
            d.structuredContent,
          ),
          layoutGeneration: d.layoutGeneration + 1,
          updatedAt: Date.now(),
        };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const replaceSlidesFromPlainContent = useCallback(
    (rows: SlideContent[]) => {
      setDeck((d) => {
        const lib = loadTemplateLibrary();
        let company =
          lib.find((c) => c.id === d.activeCompanyTemplateId) ?? null;
        if (!company?.slideTemplates?.length) {
          company =
            lib.find((c) => c.slideTemplates.length > 0) ?? null;
          if (company) {
            console.warn(
              "[deck] No active pack with templates — using first library pack:",
              company.name,
            );
          }
        }
        if (company?.slideTemplates?.length) {
          const built = buildSlideModelsFromContentRows(rows, company);
          return {
            ...d,
            slides: built.slides,
            slideModels: built.models,
            structuredContent: built.structured,
            editorSlides: null,
            wizardStep: 2,
            layoutGeneration: d.layoutGeneration + 1,
            updatedAt: Date.now(),
          };
        }
        console.warn(
          "[deck] No template pack with slide layouts; outline cleared.",
        );
        return {
          ...d,
          slides: [],
          slideModels: [],
          structuredContent: null,
          editorSlides: null,
          wizardStep: 2,
          layoutGeneration: d.layoutGeneration + 1,
          updatedAt: Date.now(),
        };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const setActiveCompanyTemplate = useCallback(
    (args: {
      id: string;
      name: string;
      allowedTemplateSlideIds: string[] | null;
    }) => {
      setDeck((d) => {
        const lib = loadTemplateLibrary();
        const company = lib.find((c) => c.id === args.id) ?? null;
        const pool = args.allowedTemplateSlideIds;
        let slides = d.slides;
        let slideModels = d.slideModels;
        let editorSlides = d.editorSlides;
        let layoutGeneration = d.layoutGeneration;

        let structuredContent = d.structuredContent;
        if (company && company.slideTemplates.length > 0 && d.slides.length > 0) {
          const rebuilt = rebuildSlideModelsFromDeckSlides(
            d.slides,
            company,
            d.structuredContent,
          );
          slides = rebuilt.slides;
          slideModels = rebuilt.models;
          structuredContent = rebuilt.structured;
          editorSlides = null;
          layoutGeneration = d.layoutGeneration + 1;
        } else if (!company || company.slideTemplates.length === 0) {
          slideModels = null;
        }

        return {
          ...d,
          activeCompanyTemplateId: args.id,
          activeCompanyTemplateName: args.name,
          allowedTemplateSlideIds: pool,
          slides,
          slideModels,
          structuredContent,
          editorSlides,
          layoutGeneration,
          updatedAt: Date.now(),
        };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const updateDeckSlide = useCallback(
    (id: string, patch: Partial<DeckSlide>) => {
      const mappingOnly = isMappingOnlyPatch(patch);
      setDeck((d) => {
        const slides = d.slides.map((s) =>
          s.id === id
            ? refreshDerivedSlideFields({ ...s, ...patch })
            : s,
        );
        const idx = slides.findIndex((s) => s.id === id);
        let structuredContent = d.structuredContent;
        if (
          !mappingOnly &&
          structuredContent &&
          idx >= 0 &&
          structuredContent.sections.length === slides.length
        ) {
          structuredContent = replaceStructuredSectionForSlide(
            structuredContent,
            idx,
            slides[idx],
          );
        }
        return {
          ...d,
          slides,
          structuredContent,
          slideModels: mappingOnly ? d.slideModels : null,
          editorSlides: mappingOnly ? d.editorSlides : null,
          layoutGeneration: mappingOnly
            ? d.layoutGeneration
            : d.layoutGeneration + 1,
          updatedAt: Date.now(),
        };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const pushEditorSlides = useCallback(
    (editorSlides: EditorSlide[]) => {
      setDeck((d) => {
        const slides = d.slides.map((s, i) => {
          const es = editorSlides[i];
          if (!es) return s;
          const contentPatch = editorSlideToContentPatch(es);
          return refreshDerivedSlideFields({ ...s, ...contentPatch });
        });
        let structuredContent = d.structuredContent;
        if (
          structuredContent &&
          structuredContent.sections.length === slides.length
        ) {
          for (let i = 0; i < slides.length; i++) {
            if (editorSlides[i]) {
              structuredContent = replaceStructuredSectionForSlide(
                structuredContent,
                i,
                slides[i],
              );
            }
          }
        }
        return {
          ...d,
          slides,
          structuredContent,
          editorSlides: editorSlides,
          slideModels: null,
          updatedAt: Date.now(),
        };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const recordCheckpoint = useCallback(
    (label?: string) => {
      setDeck((d) => ({
        ...d,
        checkpointVersion: d.checkpointVersion + 1,
        checkpointLabel: label ?? `Checkpoint ${d.checkpointVersion + 1}`,
        updatedAt: Date.now(),
      }));
      scheduleSave();
    },
    [scheduleSave],
  );

  const newDeck = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Start a new empty deck? This replaces the outline stored in this browser.",
      )
    ) {
      return;
    }
    const fresh = createBlankDeckDocument();
    fresh.id = newDeckId();
    fresh.activeCompanyTemplateId = null;
    fresh.activeCompanyTemplateName = null;
    fresh.allowedTemplateSlideIds = null;
    setDeck(fresh);
    saveDeckToStorage(fresh);
    setLastSavedAt(fresh.updatedAt);
    setDirty(false);
  }, []);

  const loadStarterOutline = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      deck.slides.length > 0 &&
      !window.confirm(
        "Replace the current outline with a fresh starter slide? Confirm to continue.",
      )
    ) {
      return;
    }
    const lib = loadTemplateLibrary();
    const co =
      lib.find((c) => c.id === deck.activeCompanyTemplateId) ?? lib[0] ?? null;
    let outline = createStarterOutlineDeck(co);
    if (co && co.slideTemplates.length > 0 && outline.slides.length > 0) {
      const built = buildSlideModelsFromContentRows(outline.slides, co);
      outline = {
        ...outline,
        slides: built.slides,
        slideModels: built.models,
        structuredContent: built.structured,
        layoutGeneration: outline.layoutGeneration + 1,
      };
    }
    setDeck(outline);
    saveDeckToStorage(outline);
    syncDeckToHistory(outline);
    setLastSavedAt(outline.updatedAt);
    setDirty(false);
  }, [deck.slides.length, deck.activeCompanyTemplateId]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const preflight = useMemo(() => computePreflightIssues(deck), [deck]);

  const value = useMemo<DeckContextValue>(
    () => ({
      deck,
      dirty: hydrated && dirty,
      lastSavedAt,
      preflight,
      setDeckTitle,
      setWizardMeta,
      setDeckSlides,
      replaceSlidesFromPlainContent,
      setActiveCompanyTemplate,
      updateDeckSlide,
      pushEditorSlides,
      recordCheckpoint,
      newDeck,
      loadStarterOutline,
      flushSave,
    }),
    [
      deck,
      dirty,
      hydrated,
      lastSavedAt,
      preflight,
      setDeckTitle,
      setWizardMeta,
      setDeckSlides,
      replaceSlidesFromPlainContent,
      setActiveCompanyTemplate,
      updateDeckSlide,
      pushEditorSlides,
      recordCheckpoint,
      newDeck,
      loadStarterOutline,
      flushSave,
    ],
  );

  return (
    <DeckContext.Provider value={value}>{children}</DeckContext.Provider>
  );
}

export function useDeck() {
  const ctx = useContext(DeckContext);
  if (!ctx) {
    throw new Error("useDeck must be used within DeckProvider");
  }
  return ctx;
}

/** Optional: screens that may mount outside provider during tests. */
export function useDeckOptional() {
  return useContext(DeckContext);
}
