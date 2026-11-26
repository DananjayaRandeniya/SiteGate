"use client";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-panel border border-line bg-surface p-4">
      <h1 className="text-xl font-semibold">This page could not load</h1>
      <button
        type="button"
        onClick={reset}
        className="mt-3 min-h-11 rounded-control bg-brand px-4 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </section>
  );
}
