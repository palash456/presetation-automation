"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { flushSync } from "react-dom";
import { useDeck } from "@/context/deck-context";
import { useTemplateLibrary } from "@/context/template-library-context";
import { companyAllowedTemplateSlideIds } from "@/components/template-system/company-mock-data";
import { createBlankCompanyTemplate } from "@/components/template-system/blank-company-template";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import type { AddTemplateSource } from "@/components/template-system/add-template-source";
import {
  CompanyTemplateGallery,
  COMPANY_INDUSTRY_FILTERS,
  COMPANY_STYLE_FILTERS,
  COMPANY_USE_CASE_FILTERS,
} from "@/components/template-system/company-template-gallery";
import { importPipelineDialogMeta } from "@/components/template-system/template-import-dialog-meta";
import { parseTemplateDefinitionsFromJson } from "@/components/template-system/template-import-utils";

export function CreateSetupScreen() {
  const router = useRouter();
  const { companies, upsertCompany } = useTemplateLibrary();
  const { deck, setActiveCompanyTemplate, setWizardMeta } = useDeck();
  const [gallerySelectedId, setGallerySelectedId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (gallerySelectedId && companies.some((c) => c.id === gallerySelectedId)) {
      return;
    }
    setGallerySelectedId(companies[0]?.id ?? null);
  }, [companies, gallerySelectedId]);
  const [galleryPanelOpen, setGalleryPanelOpen] = useState(false);
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryFilterIndustry, setGalleryFilterIndustry] = useState<
    (typeof COMPANY_INDUSTRY_FILTERS)[number]
  >("all");
  const [galleryFilterStyle, setGalleryFilterStyle] = useState<
    (typeof COMPANY_STYLE_FILTERS)[number]
  >("all");
  const [galleryFilterUseCase, setGalleryFilterUseCase] = useState<
    (typeof COMPANY_USE_CASE_FILTERS)[number]
  >("all");
  const galleryJsonImportRef = useRef<HTMLInputElement>(null);
  const deckImportRef = useRef<HTMLInputElement>(null);
  const [importDialog, setImportDialog] = useState<
    null | { source: AddTemplateSource; fileName?: string }
  >(null);

  const companyGalleryFiltered = useMemo(() => {
    return companies.filter((c) => {
      if (galleryFilterIndustry !== "all" && c.industry !== galleryFilterIndustry) {
        return false;
      }
      if (galleryFilterStyle !== "all" && c.style !== galleryFilterStyle) {
        return false;
      }
      if (
        galleryFilterUseCase !== "all" &&
        !c.presentationUseCases.includes(galleryFilterUseCase)
      ) {
        return false;
      }
      if (gallerySearch.trim()) {
        const q = gallerySearch.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.shortDescription.toLowerCase().includes(q) &&
          !c.styleTags.some((tag) => tag.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    companies,
    galleryFilterIndustry,
    galleryFilterStyle,
    galleryFilterUseCase,
    gallerySearch,
  ]);

  const applyUseCompanyTemplate = useCallback(
    (co: CompanyTemplate) => {
      if (co.slideTemplates.length === 0) return;
      const pool = companyAllowedTemplateSlideIds(co);
      const hasConflict =
        deck.slides.length > 0 &&
        deck.activeCompanyTemplateId != null &&
        deck.activeCompanyTemplateId !== co.id;
      if (
        hasConflict &&
        typeof window !== "undefined" &&
        !window.confirm(
          "Switching design system will remap all slides to templates in the new set. Continue?",
        )
      ) {
        return;
      }
      setActiveCompanyTemplate({
        id: co.id,
        name: co.name,
        allowedTemplateSlideIds: pool.length > 0 ? pool : null,
      });
      setWizardMeta({ wizardStep: 1 });
      router.push("/create/content");
    },
    [
      deck.activeCompanyTemplateId,
      deck.slides.length,
      router,
      setActiveCompanyTemplate,
      setWizardMeta,
    ],
  );

  const openTemplateCustomize = useCallback(
    (company: CompanyTemplate) => {
      if (company.slideTemplates.length === 0) return;
      router.push(`/templates?customize=${encodeURIComponent(company.id)}`);
    },
    [router],
  );

  const handleAddTemplate = useCallback(
    (source: AddTemplateSource) => {
      setGalleryPanelOpen(false);
      if (source === "blank") {
        const pack = createBlankCompanyTemplate();
        upsertCompany(pack);
        router.push(`/templates?customize=${encodeURIComponent(pack.id)}`);
        return;
      }
      if (source === "json") {
        galleryJsonImportRef.current?.click();
        return;
      }
      if (source === "deck") {
        deckImportRef.current?.click();
        return;
      }
      setImportDialog({ source });
    },
    [router, upsertCompany],
  );

  const onGalleryJsonImport = useCallback(
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
              "Could not read slide templates from this file. Use an array of layouts or { templates: [...] } / { slideTemplates: [...] }.",
            );
            return;
          }
          const pack: CompanyTemplate = {
            id: `co-json-${Date.now().toString(36)}`,
            name: f.name.replace(/\.json$/i, "") || "Imported JSON pack",
            shortDescription: "Imported from JSON",
            industry: "General",
            style: "Minimal",
            presentationUseCases: ["Internal"],
            styleTags: ["Imported", "JSON"],
            slideTemplates: defs,
          };
          flushSync(() => {
            upsertCompany(pack);
          });
          router.push(`/templates?customize=${encodeURIComponent(pack.id)}`);
        } catch {
          window.alert("Invalid JSON file.");
        }
      };
      reader.readAsText(f);
    },
    [router, upsertCompany],
  );

  const onDeckFilePicked = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      const lower = f.name.toLowerCase();
      if (!lower.endsWith(".pptx")) {
        setImportDialog({ source: "deck", fileName: f.name });
        return;
      }
      try {
        const { pptxFileToCompanyTemplate } = await import(
          "@/components/template-system/pptx-import"
        );
        const pack = await pptxFileToCompanyTemplate(f);
        upsertCompany(pack);
        router.push(`/templates?customize=${encodeURIComponent(pack.id)}`);
      } catch (err) {
        console.error(err);
        window.alert(
          err instanceof Error
            ? err.message
            : "Could not read this .pptx file.",
        );
      }
    },
    [router, upsertCompany],
  );

  const dialogCopy = importDialog
    ? importPipelineDialogMeta(importDialog.source, importDialog.fileName)
    : null;

  return (
    <>
      <input
        ref={galleryJsonImportRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onGalleryJsonImport}
      />
      <input
        ref={deckImportRef}
        type="file"
        accept=".ppt,.pptx,.key,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onDeckFilePicked}
      />
      {importDialog && dialogCopy ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-import-pipeline-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/45"
            aria-label="Dismiss"
            onClick={() => setImportDialog(null)}
          />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-2xl">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h2
                id="create-import-pipeline-title"
                className="text-sm font-semibold tracking-tight"
              >
                {dialogCopy.title}
              </h2>
            </div>
            <div className="max-h-[min(60vh,320px)] overflow-y-auto px-5 py-4">
              <p className="text-sm leading-relaxed text-[var(--muted)]">
                {dialogCopy.body}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--background)]/40 px-5 py-4">
              <button
                type="button"
                onClick={() => setImportDialog(null)}
                className="inline-flex h-10 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-4 text-sm font-medium transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportDialog(null);
                  router.push("/templates");
                }}
                className="inline-flex h-10 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
              >
                Open template library
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <CompanyTemplateGallery
        companies={companies}
        filtered={companyGalleryFiltered}
        selectedId={gallerySelectedId}
        onSelect={setGallerySelectedId}
        searchQuery={gallerySearch}
        onSearchChange={setGallerySearch}
        filterIndustry={galleryFilterIndustry}
        onFilterIndustry={setGalleryFilterIndustry}
        filterStyle={galleryFilterStyle}
        onFilterStyle={setGalleryFilterStyle}
        filterUseCase={galleryFilterUseCase}
        onFilterUseCase={setGalleryFilterUseCase}
        panelOpen={galleryPanelOpen}
        onPanelOpenChange={setGalleryPanelOpen}
        onUseTemplate={applyUseCompanyTemplate}
        onCustomize={openTemplateCustomize}
        onAddTemplate={handleAddTemplate}
        pageTitle="Presentation setup"
        pageSubtitle="Pick a design system for this deck. You can refine slide layouts anytime from Templates."
      />
    </>
  );
}
