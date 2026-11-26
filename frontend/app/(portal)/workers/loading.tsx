export default function Loading() {
  return (
    <section
      role="status"
      className="grid gap-5 rounded-panel border border-line bg-surface p-5 md:p-7"
    >
      <p className="text-sm font-semibold text-ink">Loading worker data…</p>
      <div aria-hidden="true" className="grid gap-3 motion-safe:animate-pulse">
        <div className="h-10 w-full max-w-sm rounded-control bg-neutral" />
        {Array.from({ length: 4 }, (_, row) => (
          <div key={row} className="h-8 rounded-control bg-neutral" />
        ))}
      </div>
    </section>
  );
}
