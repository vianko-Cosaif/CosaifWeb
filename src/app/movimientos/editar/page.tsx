import EditarMovimiento from "./EditarMovimiento";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      <EditarMovimiento apiBase={process.env.NEXT_PUBLIC_API_BASE} />
    </main>
  );
}
