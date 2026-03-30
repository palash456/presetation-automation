"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "./app-header";
import { KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";
import { AppSidebar } from "./app-sidebar";
import { chromelessRoutes, panelRoutes } from "./nav-config";

const STORAGE_KEY = "ppt-shell-sidebar-collapsed";

type AppShellProps = {
  children: React.ReactNode;
};

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

function RightContextPanel({ pathname }: { pathname: string }) {
  const show = panelRoutes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!show) return null;

  return (
    <aside
      className="hidden w-[min(400px,32vw)] min-w-[280px] shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-raised)] transition-[width,opacity] duration-200 ease-out lg:flex"
      aria-label="Context"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-[var(--border-subtle)] px-4">
        <h2 className="text-sm font-semibold tracking-tight">Assistant</h2>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          Outline, prompts, and suggestions for this deck will appear here as
          you build.
        </p>
      </div>
    </aside>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarCollapsed();

  const chromeless = chromelessRoutes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (chromeless) {
    return (
      <div className="h-[100dvh] min-h-0 overflow-hidden bg-[var(--background)] text-foreground">
        <KeyboardShortcutsModal />
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[var(--background)] text-foreground">
      <KeyboardShortcutsModal />
      <AppSidebar collapsed={collapsed} onToggleCollapse={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <div className="flex min-h-0 flex-1">
          <main
            id="main-content"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-[var(--background)]"
            tabIndex={-1}
          >
            {children}
          </main>
          <RightContextPanel pathname={pathname} />
        </div>
      </div>
    </div>
  );
}
