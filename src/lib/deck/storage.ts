import type { DeckDocument } from "./types";
import { createBlankDeckDocument } from "./helpers";

const STORAGE_KEY = "present-deck-document-v1";

function migrate(raw: unknown): DeckDocument {
  if (!raw || typeof raw !== "object") return createBlankDeckDocument();
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !Array.isArray(o.slides)) {
    return createBlankDeckDocument();
  }
  const doc = o as unknown as DeckDocument;
  if (typeof doc.checkpointVersion !== "number") {
    doc.checkpointVersion = 1;
  }
  if (!doc.entryMethod) doc.entryMethod = "paste";
  if (typeof doc.pasteText !== "string") doc.pasteText = "";
  if (typeof doc.aiPrompt !== "string") doc.aiPrompt = "";
  if (doc.uploadLabel !== null && typeof doc.uploadLabel !== "string") {
    doc.uploadLabel = null;
  }
  if (doc.wizardStep !== 1 && doc.wizardStep !== 2) doc.wizardStep = 1;
  if (typeof doc.layoutGeneration !== "number") doc.layoutGeneration = 0;
  if (doc.activeCompanyTemplateId === undefined) {
    doc.activeCompanyTemplateId = null;
  }
  if (doc.activeCompanyTemplateName === undefined) {
    doc.activeCompanyTemplateName = null;
  }
  if (doc.allowedMappingPresetIds === undefined) {
    doc.allowedMappingPresetIds = null;
  }
  return doc;
}

export function loadDeckFromStorage(): DeckDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDeckToStorage(doc: DeckDocument): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* quota / private mode */
  }
}

export { STORAGE_KEY };
