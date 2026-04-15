"use client";

import { useEffect, useState } from "react";
import {
  applyThemeClass,
  readStoredTheme,
  writeStoredTheme,
  type ThemeChoice,
} from "./theme-sync";

const AI_CONTROL_KEY = "present-settings-ai-control";
const AI_AGGRESS_KEY = "present-settings-ai-aggressive";
const TPL_DEFAULT_KEY = "present-settings-template-default";
const TPL_DENSITY_KEY = "present-settings-template-density";
const EXP_FORMAT_KEY = "present-settings-export-format";
const EXP_COMPRESS_KEY = "present-settings-export-compress";

type AiControl = "manual" | "assisted" | "auto";
type Aggressiveness = "low" | "balanced" | "high";
type Density = "low" | "medium" | "high";
type ExportFormat = "pptx" | "pdf";

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

function readLs<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && allowed.includes(v as T)) return v as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeLs(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const TEMPLATE_OPTIONS = [
  { value: "title-hero", label: "Title — Hero" },
  { value: "content-classic", label: "Content — Classic" },
  { value: "comparison-split", label: "Comparison — Split" },
  { value: "data-focus", label: "Data — Focus" },
] as const;

function readTemplateDefault(): string {
  try {
    const v = localStorage.getItem(TPL_DEFAULT_KEY);
    if (v && TEMPLATE_OPTIONS.some((o) => o.value === v)) return v;
  } catch {
    /* ignore */
  }
  return "title-hero";
}

export function SettingsScreen() {
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [aiControl, setAiControl] = useState<AiControl>("assisted");
  const [aggressiveness, setAggressiveness] =
    useState<Aggressiveness>("balanced");
  const [templateDefault, setTemplateDefault] = useState<string>("title-hero");
  const [density, setDensity] = useState<Density>("medium");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pptx");
  const [compressImages, setCompressImages] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
      setTheme(readStoredTheme() ?? "system");
      setAiControl(
        readLs(AI_CONTROL_KEY, ["manual", "assisted", "auto"] as const, "assisted"),
      );
      setAggressiveness(
        readLs(AI_AGGRESS_KEY, ["low", "balanced", "high"] as const, "balanced"),
      );
      setTemplateDefault(readTemplateDefault());
      setDensity(
        readLs(TPL_DENSITY_KEY, ["low", "medium", "high"] as const, "medium"),
      );
      setExportFormat(
        readLs(EXP_FORMAT_KEY, ["pptx", "pdf"] as const, "pptx"),
      );
      setCompressImages(
        readLs(EXP_COMPRESS_KEY, ["0", "1"] as const, "0") === "1",
      );
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const persistTheme = (t: ThemeChoice) => {
    setTheme(t);
    writeStoredTheme(t);
    applyThemeClass(t);
  };

  if (!mounted) {
    return (
      <div className="mx-auto max-w-xl px-6 py-12 sm:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--surface-inset)]" />
        <div className="mt-8 h-32 animate-pulse rounded-2xl bg-[var(--surface-inset)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10 sm:px-8 sm:py-12">
      <header className="border-b border-[var(--border-subtle)] pb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Defaults for AI, templates, export, and appearance.
        </p>
      </header>

      <div className="divide-y divide-[var(--border-subtle)]">
        <SettingsSection
          title="AI behavior"
          description="How much the assistant acts on its own versus waiting for you."
        >
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">Control</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  {
                    id: "manual" as const,
                    label: "Manual",
                    hint: "Suggestions only; you apply each change",
                  },
                  {
                    id: "assisted" as const,
                    label: "Assisted",
                    hint: "Inline edits; confirm for structural changes",
                  },
                  {
                    id: "auto" as const,
                    label: "Auto",
                    hint: "Applies low-risk fixes without asking",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAiControl(opt.id);
                    writeLs(AI_CONTROL_KEY, opt.id);
                  }}
                  className={cn(
                    "flex min-w-[6.5rem] flex-1 flex-col rounded-xl border px-3 py-2.5 text-left text-sm transition-colors sm:min-w-0 sm:flex-none",
                    aiControl === opt.id
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20"
                      : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--muted)]/40",
                  )}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <p className="text-xs font-medium text-[var(--muted)]">
              Aggressiveness
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              When AI is in Auto or Assisted, how strongly it rewrites or expands
              content.
            </p>
            <div className="mt-3 flex gap-2">
              {(
                [
                  ["low", "Low"] as const,
                  ["balanced", "Balanced"] as const,
                  ["high", "High"] as const,
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setAggressiveness(id);
                    writeLs(AI_AGGRESS_KEY, id);
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium transition-colors",
                    aggressiveness === id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-inset)] text-foreground hover:bg-[var(--border-subtle)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Template defaults"
          description="Starting point for new presentations."
        >
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted)]">
              Default layout
            </span>
            <select
              value={templateDefault}
              onChange={(e) => {
                setTemplateDefault(e.target.value);
                writeLs(TPL_DEFAULT_KEY, e.target.value);
              }}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
            >
              {TEMPLATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-5">
            <span className="text-xs font-medium text-[var(--muted)]">
              Content density
            </span>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["low", "Low"] as const,
                  ["medium", "Medium"] as const,
                  ["high", "High"] as const,
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setDensity(id);
                    writeLs(TPL_DENSITY_KEY, id);
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium transition-colors",
                    density === id
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "bg-[var(--surface-inset)] hover:bg-[var(--border-subtle)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Export preferences"
          description="Used as defaults in Preview & export."
        >
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted)]">
              Default format
            </span>
            <select
              value={exportFormat}
              onChange={(e) => {
                const v = e.target.value as ExportFormat;
                setExportFormat(v);
                writeLs(EXP_FORMAT_KEY, v);
              }}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
            >
              <option value="pptx">PowerPoint (.pptx)</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <ToggleRow
            className="mt-5"
            checked={compressImages}
            onChange={(v) => {
              setCompressImages(v);
              writeLs(EXP_COMPRESS_KEY, v ? "1" : "0");
            }}
            label="Compress images by default"
            description="Smaller files; slight quality tradeoff."
          />
        </SettingsSection>

        <SettingsSection
          title="Theme"
          description="Appearance of the app. System follows your OS."
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["system", "System"] as const,
                ["light", "Light"] as const,
                ["dark", "Dark"] as const,
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => persistTheme(id)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
                  theme === id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-inset)] hover:bg-[var(--border-subtle)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-8 first:pt-10">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--accent)]" : "bg-[var(--surface-inset)]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}
