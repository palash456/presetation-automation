"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Search } from "lucide-react";

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) handler();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, handler, enabled]);
}

export function AppHeader() {
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        focusSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSearch]);

  useClickOutside(profileRef, () => setProfileOpen(false), profileOpen);
  useClickOutside(notifRef, () => setNotifOpen(false), notifOpen);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4">
      <div className="relative min-w-0 flex-1 max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search templates, decks, and slides…"
          aria-label="Global search"
          className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--background)] pl-10 pr-20 text-sm text-foreground placeholder:text-[var(--muted)] transition-shadow focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-muted)]"
        />
        <kbd
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--muted)] sm:inline-block"
          aria-hidden
        >
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link
          href="/create/setup"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
        >
          Create presentation
        </Link>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="relative flex size-10 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            aria-label="Notifications"
          >
            <Bell className="size-5" strokeWidth={1.75} />
          </button>
          {notifOpen && (
            <div
              className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-2 shadow-lg shadow-black/5 dark:shadow-black/40"
              role="dialog"
              aria-label="Notifications"
            >
              <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                You&apos;re all caught up.
              </p>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-1 rounded-xl p-1 pr-2 transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--surface-inset)] text-xs font-semibold text-foreground">
              You
            </span>
            <ChevronDown className="size-4 text-[var(--muted)]" aria-hidden />
          </button>
          {profileOpen && (
            <div
              className="absolute right-0 top-12 z-50 min-w-[200px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 shadow-lg shadow-black/5 dark:shadow-black/40"
              role="menu"
            >
              <Link
                href="/settings#profile"
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-foreground hover:bg-[var(--surface-inset)]"
                onClick={() => setProfileOpen(false)}
              >
                Profile
              </Link>
              <Link
                href="/settings#shortcuts"
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-foreground hover:bg-[var(--surface-inset)]"
                onClick={() => setProfileOpen(false)}
              >
                Keyboard shortcuts
              </Link>
              <Link
                href="/settings#appearance"
                role="menuitem"
                className="block px-4 py-2.5 text-sm text-foreground hover:bg-[var(--surface-inset)]"
                onClick={() => setProfileOpen(false)}
              >
                Theme
              </Link>
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2.5 text-left text-sm text-[var(--muted)] hover:bg-[var(--surface-inset)]"
                onClick={() => setProfileOpen(false)}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
