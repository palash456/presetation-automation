"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import {
  libraryNav,
  pathMatchesNav,
  primaryNav,
  systemNav,
  type NavItem,
} from "./nav-config";

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function NavSection({
  items,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathMatchesNav(pathname, item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={collapsed ? `${item.label}${item.shortcut ? ` · ${item.shortcut}` : ""}` : undefined}
              className={[
                "relative group flex h-10 items-center gap-2 rounded-lg transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                active
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-inset)] hover:text-foreground",
              ].join(" ")}
            >
              <Icon
                className="size-5 shrink-0"
                strokeWidth={active ? 2 : 1.75}
                aria-hidden
              />
              {!collapsed && (
                <span
                  className={`truncate text-sm ${active ? "font-semibold" : "font-medium"}`}
                >
                  {item.label}
                </span>
              )}
              {active && !collapsed && (
                <span
                  className="ml-auto h-4 w-1 shrink-0 rounded-full bg-[var(--accent)]"
                  aria-hidden
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppSidebar({ collapsed, onToggleCollapse }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="shell-sidebar flex h-full shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-raised)]"
      style={{
        width: collapsed
          ? "var(--sidebar-collapsed)"
          : "var(--sidebar-expanded)",
      }}
    >
      <div
        className="flex h-14 shrink-0 items-center border-b border-[var(--border-subtle)]"
        style={{ paddingInline: collapsed ? 0 : 12 }}
      >
        {!collapsed && (
          <span className="px-3 text-sm font-semibold tracking-tight">
            Present
          </span>
        )}
        {collapsed && (
          <span className="sr-only">Present — presentation builder</span>
        )}
      </div>

      <nav
        className="flex flex-1 flex-col gap-4 overflow-y-auto p-2"
        aria-label="Main"
      >
        <NavSection
          items={primaryNav}
          pathname={pathname}
          collapsed={collapsed}
        />
        <div
          className="mx-2 h-px bg-[var(--border-subtle)]"
          aria-hidden
        />
        <NavSection
          items={libraryNav}
          pathname={pathname}
          collapsed={collapsed}
        />
        <div className="flex-1" />
        <NavSection
          items={systemNav}
          pathname={pathname}
          collapsed={collapsed}
        />
      </nav>

      <div className="border-t border-[var(--border-subtle)] p-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="size-5" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
