import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-4 pt-10">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/workers" className="text-brand underline">
        Go to Workers
      </Link>
    </main>
  );
}
