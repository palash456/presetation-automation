"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkPlus, FileStack } from "lucide-react";
import { useDeck } from "@/context/deck-context";

const DECK_ROUTES = ["/create"];

function fmtTime(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export function DeckWorkspaceBar() {
  const pathname = usePathname();
  const {
    deck,
    dirty,
    lastSavedAt,
    setDeckTitle,
    recordCheckpoint,
    newDeck,
    loadStarterOutline,
    flushSave,
  } = useDeck();
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(deck.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitTitle = useCallback(() => {
    setDeckTitle(titleDraft);
    setEditing(false);
  }, [setDeckTitle, titleDraft]);

  const show = DECK_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const savedLabel = dirty
    ? "Unsaved changes…"
    : lastSavedAt
      ? `Saved ${fmtTime(lastSavedAt)}`
      : "Local draft";

  if (!show) return null;

  return (
    <div className="flex h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border-subtle)] bg-[var(--background)] px-3 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="hidden shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] sm:inline">
          Deck
        </span>
        {editing ? (
          <input
            ref={inputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitleDraft(deck.title);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-0.5 text-sm font-medium focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-muted)]"
            aria-label="Deck title"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(deck.title);
              setEditing(true);
            }}
            className="min-w-0 truncate rounded px-1 text-left text-sm font-semibold tracking-tight text-foreground hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {deck.title}
          </button>
        )}
        <span
          className="hidden shrink-0 text-xs text-[var(--muted)] sm:inline"
          title="Stored in this browser (local)"
        >
          {savedLabel}
        </span>
        {deck.activeCompanyTemplateName && (
          <span
            className="hidden max-w-[180px] truncate text-[10px] text-[var(--muted)] xl:inline"
            title="Presentation style / design system"
          >
            · {deck.activeCompanyTemplateName}
          </span>
        )}
        {deck.checkpointLabel && (
          <span className="hidden max-w-[140px] truncate text-[10px] text-[var(--muted)] lg:inline">
            · v{deck.checkpointVersion} {deck.checkpointLabel}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {deck.slides.length === 0 && (
          <button
            type="button"
            onClick={loadStarterOutline}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <FileStack className="size-3.5" />
            Starter outline
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            recordCheckpoint();
            flushSave();
          }}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          title="Mark this state in version history"
        >
          <BookmarkPlus className="size-3.5" />
          Checkpoint
        </button>
        <button
          type="button"
          onClick={newDeck}
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          New
        </button>
      </div>
    </div>
  );
}
