"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DECK_WORKFLOW, getWorkflowStepIndex } from "./deck-workflow";

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

export function CreativeWorkflowBar() {
  const pathname = usePathname();
  /** Creation flow lives only under `/create/...` (not global browsing). */
  if (!pathname.startsWith("/create/")) return null;
  const activeIdx = getWorkflowStepIndex(pathname);
  /* Hide Export step in this bar (preview is chromeless / separate surface). */
  if (activeIdx === null || activeIdx >= 4) return null;

  return (
    <nav
      className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 sm:gap-2 sm:px-4"
      aria-label="Deck workflow"
    >
      <span className="hidden shrink-0 pr-2 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] sm:inline">
        Deck
      </span>
      {DECK_WORKFLOW.map((step, i) => {
        const current = i === activeIdx;
        const past = i < activeIdx;
        return (
          <span key={step.path} className="flex shrink-0 items-center gap-1">
            {i > 0 && (
              <span className="text-[var(--border-subtle)] select-none" aria-hidden>
                /
              </span>
            )}
            {current ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/35 bg-[var(--accent-muted)] px-2 py-0.5"
                title={step.description}
              >
                <span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">
                  {String(step.index).padStart(2, "0")}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {step.label}
                </span>
              </span>
            ) : (
              <Link
                href={step.path}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 transition-colors",
                  past
                    ? "text-[var(--muted)] hover:bg-[var(--surface-inset)] hover:text-foreground"
                    : "text-[var(--muted)] hover:text-foreground",
                )}
                title={step.description}
              >
                <span className="font-mono text-[10px] tabular-nums">
                  {String(step.index).padStart(2, "0")}
                </span>
                <span className="text-xs font-medium">{step.label}</span>
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
