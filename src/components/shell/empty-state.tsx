import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export function EmptyState({
  title,
  description,
  primary,
  secondary,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[min(420px,calc(100vh-8rem))] flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
        {description}
      </p>
      {(primary || secondary) && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {primary && (
            <Link
              href={primary.href}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              {primary.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 text-sm font-medium text-foreground transition-colors hover:bg-[var(--surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
