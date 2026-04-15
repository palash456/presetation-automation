/**
 * Single ordered path through the product — template-bound, user-controlled.
 * UI copy favors clarity and explicit stages (not marketing funnel language).
 */
/** Steps shown only under `/create/*` (presentation creation flow). */
export const DECK_WORKFLOW = [
  {
    path: "/create/setup",
    index: 1,
    label: "Setup",
    description: "Presentation style & design system",
  },
  {
    path: "/create/content",
    index: 2,
    label: "Content",
    description: "Source text & slide structure",
  },
  {
    path: "/create/mapping",
    index: 3,
    label: "Map",
    description: "Slides → templates",
  },
  {
    path: "/create/editor",
    index: 4,
    label: "Edit",
    description: "Slides in layout",
  },
  {
    path: "/preview",
    index: 5,
    label: "Export",
    description: "Review & files",
  },
] as const;

export function getWorkflowStepIndex(pathname: string): number | null {
  for (let i = 0; i < DECK_WORKFLOW.length; i++) {
    const p = DECK_WORKFLOW[i]!.path;
    if (pathname === p || pathname.startsWith(`${p}/`)) return i;
  }
  return null;
}
