"use client";

import { useEffect } from "react";

const STORAGE_KEY = "present-settings-theme";

export type ThemeChoice = "system" | "light" | "dark";

export function applyThemeClass(theme: ThemeChoice) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "light") root.classList.add("light");
  if (theme === "dark") root.classList.add("dark");
}

export function readStoredTheme(): ThemeChoice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredTheme(theme: ThemeChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Applies saved theme before paint flash (best-effort). */
export function ThemeSync() {
  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) applyThemeClass(stored);
  }, []);
  return null;
}
