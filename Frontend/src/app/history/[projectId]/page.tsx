"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ProjectTimeline } from "@/components/history/project-timeline";
import { HISTORY_CHANGED_EVENT } from "@/lib/history/history-events";
import { getPresentationHistoryEntrySnapshot } from "@/lib/history/storage";

const HISTORY_STORAGE_KEY = "present-presentation-history-v1";

export default function HistoryProjectPage() {
  const params = useParams();
  const projectId =
    typeof params.projectId === "string"
      ? params.projectId
      : Array.isArray(params.projectId)
        ? params.projectId[0]
        : "";

  const project = useSyncExternalStore(
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
    () =>
      projectId
        ? (getPresentationHistoryEntrySnapshot(projectId) ?? null)
        : null,
    () => null,
  );

  if (!projectId || !project) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-sm text-[var(--muted)]">
          This presentation is not in your local history (or it was removed).
        </p>
        <Link
          href="/history"
          className="mt-4 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Back to History
        </Link>
      </div>
    );
  }

  return <ProjectTimeline project={project} />;
}
