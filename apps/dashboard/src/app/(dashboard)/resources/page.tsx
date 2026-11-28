import { redirect } from "next/navigation";
import { ManagedResourcesPage } from "@/components/resources/ManagedResourcesPage";
import { getSession } from "@/lib/server/session";
import { CloudBillingLink } from "@/components/billing/CloudBillingLink";
import { MailPlanDetails } from "@/components/billing/MailPlanDetails";
import type { PlanResource } from "@/lib/billing-links";

/** Keep space bookmarks while the unscoped entry uses the account's plan overview. */
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  let resource: PlanResource;
  if (query.product === "email" && query.pool === undefined) {
    if (query.serviceId !== undefined && (typeof query.serviceId !== "string" || !query.serviceId))
      redirect("/billing");
    resource = { product: "email", serviceId: query.serviceId };
  } else if (typeof query.pool === "string" && query.pool && query.product !== "email") {
    resource = { pool: query.pool };
  } else {
    redirect("/billing");
  }
  const organizationId =
    typeof query.organizationId === "string" ? query.organizationId : undefined;
  const tab = (["overview", "usage", "payment", "activity", "topups"] as const).find(
    (value) => value === query.tab,
  );
  if (organizationId && (await getSession())?.session.activeOrganizationId !== organizationId) {
    return (
      <CloudBillingLink
        organizationId={organizationId}
        resource={resource}
        planTab={tab}
        tab="home"
        returnQuery={query}
      />
    );
  }
  if ("product" in resource)
    return (
      <MailPlanDetails
        key={organizationId + ":" + (resource.serviceId ?? "")}
        resource={{ ...resource, organizationId }}
        tab={tab}
      />
    );
  return <ManagedResourcesPage />;
}
