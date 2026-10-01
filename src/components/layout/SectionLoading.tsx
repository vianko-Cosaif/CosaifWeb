/** Small server-rendered fallback; preserves the shell while the destination streams. */
export default function SectionLoading() {
  return (
    <section role="status" aria-busy="true" className="mx-auto w-full max-w-screen-2xl space-y-6 py-2">
      <p className="text-sm font-medium text-[var(--app-text-muted)]">Cargando sección…</p>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-56 max-w-[60%] rounded-lg bg-[var(--app-surface-muted)]" />
          <div className="h-9 w-28 rounded-lg bg-[var(--app-surface-muted)]" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-24 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]" />)}
        </div>
        <div className="min-h-64 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
          {[0, 1, 2, 3].map(item => <div key={item} className="mb-5 h-5 rounded bg-[var(--app-surface-muted)] last:mb-0" />)}
        </div>
      </div>
    </section>
  );
}
