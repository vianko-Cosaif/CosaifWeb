// src/app/cliente/loading.tsx
export default function Loading() {
  return (
    <section
      className="mx-auto w-full max-w-7xl p-4 sm:p-6"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="sr-only">Cargando tablero de rondas y próximas órdenes…</p>

      <div className="grid gap-6 md:grid-cols-3">
        {/* IZQUIERDA: tarjeta grande (orden actual) */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-6 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                  <div className="h-5 w-36 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                  <div className="h-3 w-28 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="ml-auto h-3 w-16 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                <div className="ml-auto h-10 w-44 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="h-3 w-24 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                <div className="mt-2 h-5 w-40 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="h-3 w-24 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                <div className="mt-2 h-5 w-36 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <div className="h-6 w-20 rounded-full border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
                <div className="h-6 w-20 rounded-full border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
          </div>
        </div>

        {/* DERECHA: lista de próximas órdenes */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-5 w-40 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
            <div className="h-5 w-16 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                    <div className="h-4 w-40 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                  </div>
                  <div className="h-3 w-20 rounded bg-slate-200 animate-pulse dark:bg-slate-800" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="h-10 rounded border border-slate-200 bg-slate-50 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
                  <div className="h-10 rounded border border-slate-200 bg-slate-50 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
                </div>
                <div className="mt-2 flex gap-2">
                  <div className="h-6 w-20 rounded-full border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
                  <div className="h-6 w-20 rounded-full border border-slate-200 bg-slate-100 animate-pulse dark:border-slate-700 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
