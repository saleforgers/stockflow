export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <section className="max-w-2xl space-y-5">
        <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
          StockFlow V1.0
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Technical foundation ready for module development.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-slate-600">
          Phase 1A establishes the database, validation, decimal, and transaction foundations.
          Business workflows will be delivered in later phases.
        </p>
      </section>
    </main>
  );
}
