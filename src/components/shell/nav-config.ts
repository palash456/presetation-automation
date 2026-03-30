import { Clock, ImageIcon, LayoutGrid, LayoutTemplate, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
};

export const primaryNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, shortcut: "G D" },
  { href: "/templates", label: "Templates", icon: LayoutTemplate, shortcut: "G T" },
  { href: "/history", label: "History", icon: Clock },
];

export const libraryNav: NavItem[] = [{ href: "/assets", label: "Assets", icon: ImageIcon }];

export const systemNav: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Routes that use the shell’s slim right rail (create has its own step-2 panel). */
export const panelRoutes: string[] = [];

/** No sidebar/header — fullscreen experiences. */
export const chromelessRoutes = ["/preview"];

export function pathMatchesNav(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
