import { PageHeading } from "@/components/page-heading";

export default async function OnSitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <PageHeading title="On site" description={siteId} />;
}
