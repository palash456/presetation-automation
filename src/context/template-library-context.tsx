"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { CompanyTemplate } from "@/components/template-system/company-types";
import {
  loadTemplateLibrary,
  saveTemplateLibrary,
} from "@/components/template-system/template-library-storage";

type TemplateLibraryContextValue = {
  companies: CompanyTemplate[];
  setCompanies: Dispatch<SetStateAction<CompanyTemplate[]>>;
  upsertCompany: (c: CompanyTemplate) => void;
};

const TemplateLibraryContext = createContext<TemplateLibraryContextValue | null>(
  null,
);

export function TemplateLibraryProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanyTemplate[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setCompanies(loadTemplateLibrary());
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveTemplateLibrary(companies);
  }, [companies, ready]);

  const upsertCompany = useCallback((c: CompanyTemplate) => {
    setCompanies((prev) => {
      const i = prev.findIndex((x) => x.id === c.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = c;
        return next;
      }
      return [...prev, c];
    });
  }, []);

  const value = useMemo(
    () => ({ companies, setCompanies, upsertCompany }),
    [companies, upsertCompany],
  );

  return (
    <TemplateLibraryContext.Provider value={value}>
      {children}
    </TemplateLibraryContext.Provider>
  );
}

export function useTemplateLibrary() {
  const ctx = useContext(TemplateLibraryContext);
  if (!ctx) {
    throw new Error("useTemplateLibrary must be used within TemplateLibraryProvider");
  }
  return ctx;
}
