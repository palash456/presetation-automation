import type { CompanyTemplate } from "./company-types";

export const TEMPLATE_LIBRARY_STORAGE_KEY = "ppt-template-library-v1";

function isCompanyTemplate(v: unknown): v is CompanyTemplate {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.slideTemplates)
  );
}

export function loadTemplateLibrary(): CompanyTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATE_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCompanyTemplate);
  } catch {
    return [];
  }
}

export function saveTemplateLibrary(companies: CompanyTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEMPLATE_LIBRARY_STORAGE_KEY, JSON.stringify(companies));
  } catch {
    /* quota / private mode */
  }
}
