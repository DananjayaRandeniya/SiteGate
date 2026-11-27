import { redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { SiteGateBrand } from "@/components/sitegate-brand";
import { getPortalRole } from "@/lib/auth/session";
import { getPortalSessionSecret } from "@/lib/auth/session-token";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (await getPortalRole()) redirect("/");
  const enabled = Boolean(getPortalSessionSecret());
  const { error } = await searchParams;
  return (
    <main className="mx-4 mt-10 grid max-w-md gap-4 rounded-panel border border-line bg-surface p-6 sm:mx-auto">
      <SiteGateBrand />
      <PageHeading
        title="Sign in"
        description="Choose a role for the SiteGate training portal."
      />
      {enabled ? (
        <form action={signIn} className="grid gap-3">
          <label htmlFor="role" className="text-sm font-semibold">
            Role
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue=""
            className="min-h-11 rounded-control border border-input-border bg-surface px-3"
          >
            <option value="">Choose a role</option>
            <option value="Admin">Site Admin</option>
            <option value="Manager">Site Manager</option>
          </select>
          {error === "role" && (
            <p role="alert" className="text-sm text-danger">
              Choose a role to sign in.
            </p>
          )}
          <button
            type="submit"
            className="min-h-11 rounded-control bg-brand px-4 text-sm font-semibold text-white"
          >
            Sign in
          </button>
        </form>
      ) : (
        <p role="status" className="text-sm text-muted">
          Training sign-in is unavailable. Ask the team to enable it for this
          environment.
        </p>
      )}
    </main>
  );
}
