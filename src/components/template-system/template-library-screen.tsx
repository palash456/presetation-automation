"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { flushSync } from "react-dom";
import { Layers } from "lucide-react";
import { useDeck } from "@/context/deck-context";
import { useTemplateLibrary } from "@/context/template-library-context";
import { companyMappingPresetPool } from "./company-mock-data";
import { createBlankCompanyTemplate } from "./blank-company-template";
import type { CompanyTemplate } from "./company-types";
import type { AddTemplateSource } from "./add-template-source";
import { ADD_TEMPLATE_OPTIONS } from "./add-template-options";
import {
  CompanyTemplateGallery,
  COMPANY_INDUSTRY_FILTERS,
  COMPANY_STYLE_FILTERS,
  COMPANY_USE_CASE_FILTERS,
} from "./company-template-gallery";
import { cloneCompanyTemplate } from "./clone-company";
import { importPipelineDialogMeta } from "./template-import-dialog-meta";
import { parseTemplateDefinitionsFromJson } from "./template-import-utils";
import {
  STAGED_PACK_QUERY,
  STAGED_PACK_STORAGE_KEY,
} from "./staged-template-pack";

type SortKey = "recent" | "name";

function NoTemplatesEmptyState({
  onPick,
}: {
  onPick: (source: AddTemplateSource) => void;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] w-full flex-col items-center justify-center bg-[var(--background)] px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-sm">
        <div className="border-b border-[var(--border-subtle)] px-6 py-8 text-center sm:px-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)]">
            <Layers className="size-7" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            No templates yet
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            Choose how to add your first design system — every option is
            available here in one place.
          </p>
        </div>
        <div className="max-h-[min(55vh,480px)] overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            New template
          </p>
          <ul className="flex flex-col gap-1">
            {ADD_TEMPLATE_OPTIONS.map(
              ({ source, label, description, icon: Icon }) => (
                <li key={source}>
                  <button
                    type="button"
                    onClick={() => onPick(source)}
                    className="flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--surface-inset)] focus-visible:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-inset)] text-[var(--accent)] sm:size-11">
                      <Icon className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">
                        {description}
                      </span>
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function TemplateLibraryScreen() {
  const router = useRouter();
  const { companies, setCompanies, upsertCompany } = useTemplateLibrary();
  const { setActiveCompanyTemplate, setWizardMeta } = useDeck();
  const [gallerySelectedId, setGallerySelectedId] = useState<string | null>(
    companies[0]?.id ?? null,
  );
  const [galleryPanelOpen, setGalleryPanelOpen] = useState(false);
  const [gallerySearch, setGallerySearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
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
  const [manageCompany, setManageCompany] = useState<CompanyTemplate | null>(
    null,
  );
  const [manageNameDraft, setManageNameDraft] = useState("");

  const companyGalleryFiltered = useMemo(() => {
    let list = companies.filter((c) => {
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

    if (sortKey === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = [...list].reverse();
    }
    return list;
  }, [
    companies,
    galleryFilterIndustry,
    galleryFilterStyle,
    galleryFilterUseCase,
    gallerySearch,
    sortKey,
  ]);

  const startPresentationWithPack = useCallback(
    (co: CompanyTemplate) => {
      if (co.slideTemplates.length === 0) return;
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          `Start a new presentation using “${co.name}”? You can continue in the creation flow.`,
        )
      ) {
        return;
      }
      const pool = companyMappingPresetPool(co);
      setActiveCompanyTemplate({
        id: co.id,
        name: co.name,
        allowedMappingPresetIds: pool.length > 0 ? pool : null,
      });
      setWizardMeta({ wizardStep: 1 });
      router.push("/create/content");
    },
    [router, setActiveCompanyTemplate, setWizardMeta],
  );

  const openCustomize = useCallback(
    (co: CompanyTemplate) => {
      if (co.slideTemplates.length === 0) return;
      const known = companies.some((c) => c.id === co.id);
      if (known) {
        router.push(`/templates?customize=${encodeURIComponent(co.id)}`);
        return;
      }
      try {
        sessionStorage.setItem(STAGED_PACK_STORAGE_KEY, JSON.stringify(co));
        router.push(`/templates?customize=${STAGED_PACK_QUERY}`);
      } catch {
        window.alert("Could not open editor for this pack.");
      }
    },
    [router, companies],
  );

  const duplicatePack = useCallback(
    (co: CompanyTemplate) => {
      const copy = cloneCompanyTemplate(co);
      copy.id = `${co.id}-copy-${Date.now().toString(36)}`;
      copy.name = `${co.name} (copy)`;
      setCompanies((prev) => [...prev, copy]);
    },
    [setCompanies],
  );

  const openManage = useCallback((co: CompanyTemplate) => {
    setManageCompany(co);
    setManageNameDraft(co.name);
  }, []);

  const saveManage = useCallback(() => {
    if (!manageCompany) return;
    const nextName = manageNameDraft.trim() || manageCompany.name;
    setCompanies((prev) =>
      prev.map((c) => (c.id === manageCompany.id ? { ...c, name: nextName } : c)),
    );
    setManageCompany(null);
  }, [manageCompany, manageNameDraft, setCompanies]);

  const deletePack = useCallback(() => {
    if (!manageCompany) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove “${manageCompany.name}” from your library? This removes it from storage in this browser.`,
      )
    ) {
      return;
    }
    setCompanies((prev) => prev.filter((c) => c.id !== manageCompany.id));
    setManageCompany(null);
  }, [manageCompany, setCompanies]);

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
        const { pptxFileToCompanyTemplate } = await import("./pptx-import");
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
          aria-labelledby="lib-import-title"
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
                id="lib-import-title"
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
                className="inline-flex h-10 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-4 text-sm font-medium hover:bg-[var(--surface-inset)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manageCompany ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-pack-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/45"
            aria-label="Dismiss"
            onClick={() => setManageCompany(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-2xl">
            <h2
              id="manage-pack-title"
              className="text-sm font-semibold tracking-tight"
            >
              Manage template pack
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Rename, version history, and sharing options ship in the full
              product.
            </p>
            <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Display name
            </label>
            <input
              value={manageNameDraft}
              onChange={(e) => setManageNameDraft(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] px-3 text-sm"
            />
            <div className="mt-5 flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={deletePack}
                className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Remove from library
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setManageCompany(null)}
                  className="h-10 rounded-xl border border-[var(--border-subtle)] px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveManage}
                  className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {companies.length === 0 ? (
        <NoTemplatesEmptyState onPick={handleAddTemplate} />
      ) : (
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
          onUseTemplate={startPresentationWithPack}
          onCustomize={openCustomize}
          onAddTemplate={handleAddTemplate}
          interactionMode="library"
          onDuplicate={duplicatePack}
          onManage={openManage}
          sortControl={
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm"
              aria-label="Sort templates"
            >
              <option value="recent">Recent</option>
              <option value="name">Name A–Z</option>
            </select>
          }
          pageTitle="All Templates"
          pageSubtitle="Browse and manage presentation styles. Starting a deck happens from Create presentation — not here."
        />
      )}
    </>
  );
}
