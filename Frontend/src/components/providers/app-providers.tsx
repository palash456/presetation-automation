"use client";

import type { ReactNode } from "react";
import { DeckProvider } from "@/context/deck-context";
import { TemplateLibraryProvider } from "@/context/template-library-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TemplateLibraryProvider>
      <DeckProvider>{children}</DeckProvider>
    </TemplateLibraryProvider>
  );
}
