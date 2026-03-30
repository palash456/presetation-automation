import type { DeckDocument } from "@/lib/deck/types";
import type { PresentationHistory } from "@/components/history/types";
import { notifyHistoryChanged } from "./history-events";

const HISTORY_KEY = "present-presentation-history-v1";

const LOCAL_DRAFT_ID = "local-draft";

function isHistoryEntry(v: unknown): v is PresentationHistory {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.lastEdited === "string" &&
    typeof o.versionCount === "number" &&
    Array.isArray(o.versions)
  );
}

export function loadPresentationHistory(): PresentationHistory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry);
  } catch {
    return [];
  }
}

export function savePresentationHistory(items: PresentationHistory[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

/** Upsert a timeline row when a non-draft deck is saved locally. */
export function syncDeckToHistory(deck: DeckDocument): void {
  if (deck.id === LOCAL_DRAFT_ID) return;
  if (deck.slides.length === 0) return;

  const iso = new Date(deck.updatedAt).toISOString();
  const list = loadPresentationHistory();
  const idx = list.findIndex((p) => p.id === deck.id);

  const version = {
    id: `save-${deck.updatedAt}`,
    label: deck.checkpointLabel ?? `Checkpoint ${deck.checkpointVersion}`,
    savedAt: iso,
    author: "You",
    summary:
      deck.slides.length === 1
        ? "1 slide in outline"
        : `${deck.slides.length} slides in outline`,
  };

  const nextEntry: PresentationHistory = {
    id: deck.id,
    name: deck.title.trim() || "Untitled deck",
    lastEdited: iso,
    status: "draft",
    versionCount: Math.max(1, deck.checkpointVersion),
    versions: [
      version,
      ...(idx >= 0 ? list[idx]!.versions.slice(0, 12) : []),
    ].slice(0, 20),
  };

  const merged =
    idx >= 0
      ? list.map((p, i) => (i === idx ? nextEntry : p))
      : [nextEntry, ...list];

  savePresentationHistory(merged);
  notifyHistoryChanged();
}

export function getPresentationHistoryById(
  id: string,
): PresentationHistory | undefined {
  return loadPresentationHistory().find((p) => p.id === id);
}
