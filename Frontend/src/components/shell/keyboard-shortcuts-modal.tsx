"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { primaryNav, libraryNav } from "./nav-config";

function isTypingTarget(el: EventTarget | null) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const t = el.tagName;
  if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return true;
  return el.isContentEditable;
}

const EXTRA = [
  { keys: "?", label: "This shortcut map" },
  { keys: "⌘K", label: "Focus search" },
  { keys: "← / →", label: "Slides (in preview when panel closed)" },
  { keys: "Esc", label: "Close panel or exit preview" },
] as const;

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onEsc(ev: KeyboardEvent) {
      if (ev.key === "Escape") close();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, close]);

  if (!open) return null;

  const navRows = [...primaryNav, ...libraryNav].filter((i) => i.shortcut);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="max-h-[min(560px,85vh)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Shortcuts</h2>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-inset)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-4 text-sm">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Press <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--background)] px-1 font-mono text-[11px]">?</kbd>{" "}
            outside of text fields to toggle. Sidebar labels show multi-key go-to
            hints where defined.
          </p>
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {navRows.map((item) => (
                <tr key={item.href}>
                  <td className="py-2 pr-3 font-medium">{item.label}</td>
                  <td className="py-2">
                    <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[11px]">
                      {item.shortcut}
                    </kbd>
                  </td>
                </tr>
              ))}
              {EXTRA.map((row) => (
                <tr key={row.label}>
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2">
                    <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--background)] px-1.5 py-0.5 font-mono text-[11px]">
                      {row.keys}
                    </kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
