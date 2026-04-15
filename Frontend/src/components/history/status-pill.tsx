import type { ProjectStatus } from "./types";

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

const LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "draft" &&
          "bg-zinc-200/90 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
        status === "published" &&
          "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400",
        status === "archived" &&
          "bg-amber-500/12 text-amber-900 dark:text-amber-400",
      )}
    >
      {LABELS[status]}
    </span>
  );
}
