import Link from "next/link";
import { PageHeading } from "@/components/page-heading";

export default function LoginPage() {
  return (
    <main className="mx-auto mt-10 grid max-w-md gap-4 rounded-panel border border-line bg-surface p-6">
      <PageHeading title="Sign in" description="The team is setting up role selection." />
      <Link href="/" className="w-fit text-brand underline">Back to SiteGate</Link>
    </main>
  );
}
