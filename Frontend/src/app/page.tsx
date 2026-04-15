import { EmptyState } from "@/components/shell/empty-state";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 border-b border-[var(--border-subtle)] pb-6">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Browse templates and history, or start a new presentation when
          you&apos;re ready.
        </p>
      </header>
      <EmptyState
        title="Get started"
        description="Create a new deck or open your template library from here."
        primary={{ label: "Create presentation", href: "/create/setup" }}
        secondary={{ label: "All templates", href: "/templates" }}
      />
    </div>
  );
}
