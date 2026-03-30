"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTemplateLibrary } from "@/context/template-library-context";
import type { CompanyTemplate } from "./company-types";
import {
  STAGED_PACK_QUERY,
  STAGED_PACK_STORAGE_KEY,
} from "./staged-template-pack";
import { TemplateLibraryScreen } from "./template-library-screen";
import { TemplateCustomizeWorkspace } from "./template-system-screen";

export function TemplatesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customizeParam = searchParams.get("customize");
  const { companies, upsertCompany } = useTemplateLibrary();

  const [stagedCompany, setStagedCompany] = useState<CompanyTemplate | null>(
    null,
  );

  /* eslint-disable react-hooks/set-state-in-effect -- staged JSON import reads sessionStorage after mount */
  useEffect(() => {
    if (customizeParam !== STAGED_PACK_QUERY) {
      setStagedCompany(null);
      return;
    }
    try {
      const raw = sessionStorage.getItem(STAGED_PACK_STORAGE_KEY);
      if (!raw) {
        setStagedCompany(null);
        return;
      }
      const parsed = JSON.parse(raw) as CompanyTemplate;
      setStagedCompany(parsed);
    } catch {
      setStagedCompany(null);
    }
  }, [customizeParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeCustomizeCompany = useMemo(() => {
    if (!customizeParam) return null;
    if (customizeParam === STAGED_PACK_QUERY) return stagedCompany;
    return companies.find((c) => c.id === customizeParam) ?? null;
  }, [customizeParam, companies, stagedCompany]);

  const exitCustomize = useCallback(() => {
    router.push("/templates");
    if (customizeParam === STAGED_PACK_QUERY) {
      try {
        sessionStorage.removeItem(STAGED_PACK_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [router, customizeParam]);

  if (customizeParam && activeCustomizeCompany) {
    return (
      <TemplateCustomizeWorkspace
        key={`${customizeParam}:${activeCustomizeCompany.id}`}
        initialCompany={activeCustomizeCompany}
        onPersistCompany={upsertCompany}
        onBack={exitCustomize}
      />
    );
  }

  if (customizeParam && !activeCustomizeCompany) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm text-[var(--muted)]">
          This template pack could not be loaded.
        </p>
        <button
          type="button"
          onClick={() => router.push("/templates")}
          className="mt-4 text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Back to All Templates
        </button>
      </div>
    );
  }

  return <TemplateLibraryScreen />;
}
