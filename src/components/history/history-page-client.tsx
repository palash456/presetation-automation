"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { HISTORY_CHANGED_EVENT } from "@/lib/history/history-events";
import { loadPresentationHistory } from "@/lib/history/storage";
import { EmptyState } from "@/components/shell/empty-state";
import { HistoryProjectCards } from "./history-project-cards";

const HISTORY_STORAGE_KEY = "present-presentation-history-v1";

export function HistoryPageClient() {
  const projects = useSyncExternalStore(
    (onStoreChange) => {
      const onHist = () => onStoreChange();
      window.addEventListener(HISTORY_CHANGED_EVENT, onHist);
      const onStorage = (e: StorageEvent) => {
        if (e.key === HISTORY_STORAGE_KEY) onStoreChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(HISTORY_CHANGED_EVENT, onHist);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => loadPresentationHistory(),
    () => [],
  );

  const hasProjects = projects.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Versions and restores per presentation. Decks you save in the create
          flow appear here in this browser.
        </p>
      </header>

      {hasProjects ? (
        <HistoryProjectCards projects={projects} />
      ) : (
        <EmptyState
          title="No history yet"
          description="Save a deck with at least one slide in the create flow — it will show up here automatically."
          primary={{ label: "Go to dashboard", href: "/" }}
          secondary={{ label: "Create new presentation", href: "/create/setup" }}
        />
      )}

      {hasProjects && (
        <p className="mt-10 text-center text-sm text-[var(--muted)]">
          Need a new deck?{" "}
          <Link
            href="/create/setup"
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Create new presentation
          </Link>
        </p>
      )}
    </div>
  );
}
