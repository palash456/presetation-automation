import { EmptyState } from "@/components/shell/empty-state";

export default function AssetsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
        <h1 className="text-xl font-semibold tracking-tight">Assets</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Images, charts, and icons you reuse across decks.
        </p>
      </header>
      <EmptyState
        title="No assets"
        description="Upload images or add icons to reuse across presentations."
        primary={{ label: "Create presentation", href: "/create/setup" }}
      />
    </div>
  );
}
