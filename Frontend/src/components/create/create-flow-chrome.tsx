"use client";

import { CreativeWorkflowBar } from "@/components/workflow/creative-workflow-bar";
import { DeckWorkspaceBar } from "@/components/deck/deck-workspace-bar";

/** Deck stepper + workspace bar — only rendered inside /create/* presentation flow. */
export function CreateFlowChrome() {
  return (
    <>
      <CreativeWorkflowBar />
      <DeckWorkspaceBar />
    </>
  );
}
