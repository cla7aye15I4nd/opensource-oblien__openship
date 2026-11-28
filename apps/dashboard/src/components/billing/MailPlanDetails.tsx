"use client";

import Link from "next/link";
import { useCallback } from "react";
import type { ManagedMailSummary } from "@repo/contracts";
import { changeMailPlanHref, emailPlansHref } from "@repo/core/managed-mail";
import { Icon } from "@repo/ui/icons";
import BillingTabSkeleton from "@/app/(dashboard)/billing/_components/BillingTabSkeleton";
import { MailStatsCard } from "@/app/(dashboard)/emails/_components/admin/mail-stats-card";
import {
  SendingQuotaCard,
  useSendingUsage,
} from "@/app/(dashboard)/emails/_components/admin/sending-usage";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/PageContainer";
import { useScopedResource } from "@/hooks/use-scoped-resource";
import { mailAdminApi } from "@/lib/api";
import { managedMailApi } from "@/lib/api/managed-mail";
import { mailDashboardHref, planResourceHref, type PlanResource, type PlanDetailTab } from "@/lib/billing-links";
import { PlanDetailColumns, PlanDetailHeader, PlanDetailTabs } from "./PlanDetailLayout";
import { OpenStripePortalButton } from "@/app/(dashboard)/billing/_components/OpenStripePortalButton";
import { mailAccountProduct, mailPlanFacts, mailPlanLabel, mailServiceLabel } from "./plan-presentation";

export function MailPlanDetails({
  resource,
  tab,
}: {
  resource: Extract<PlanResource, { product: "email" }>;
  tab?: PlanDetailTab;
}) {
  const { organizationId, serviceId } = resource;
  const { t, locale } = useI18n();
  const c = t.emails.cloudClient;
  const account = useScopedResource(
    useCallback(() => managedMailApi.summary(serviceId), [serviceId]),
  );
  const data = account.data;
  const product = mailAccountProduct(data);
  const productName = mailServiceLabel(product, data?.service?.placement, c);
  const service = data?.service;
  const dedicatedWebmail = service?.placement === "dedicated" && !service.provisioning ? service.webmailUrl : null;
  const plan = data?.plan && mailPlanLabel(data.plan, c.included);
  const payments = serviceId ? !!data?.subscriptionTarget : !!data?.hasBillingAccount;
  const activeTab = tab === "usage" || (tab === "payment" && payments) ? tab : "overview";
  const planChange = data?.subscriptionTarget;
  const limits = data?.limits;
  const facts = limits
    ? mailPlanFacts(
        {
          recipients: limits.recipients,
          domains: limits.domains,
          mailboxes: product === "sending" ? undefined : limits.mailboxes,
          storageGB: product === "sending" ? undefined : limits.storageMB / 1024,
        },
        c,
        locale,
      )
    : [];
  return (
    <PageContainer className="@container/resources space-y-5">
      <PlanDetailHeader
        title={plan ? `OpenShip Mail · ${plan}` : "OpenShip Mail"}
        description={plan ? productName : undefined}
      />
      {account.error || data?.billingUnavailable ? (
        <div className="space-y-3 rounded-2xl bg-card p-5" role="alert">
          <p>{account.error ?? t.billing.plansRoute.loadError}</p>
          <Button onClick={account.refresh} variant="secondary">
            {t.actions.retry}
          </Button>
        </div>
      ) : !data ? (
        <BillingTabSkeleton />
      ) : (
        <>
          <PlanDetailTabs
            value={activeTab}
            href={(next) => planResourceHref(resource, next)}
            payments={payments}
          />
          <PlanDetailColumns
            summary={
              <>
                <section className="space-y-5 rounded-2xl bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-medium">{plan || c.plans}</h2>
                    <span className="text-sm text-muted-foreground">
                      {plan ? t.billing.hub.active : t.billing.hub.inactive}
                    </span>
                  </div>
                  {facts.length > 0 && (
                    <dl className="space-y-3 text-sm">
                      {facts.map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-4">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
                <Button asChild className="w-full">
                  <Link
                    href={
                      planChange
                        ? changeMailPlanHref(planChange, organizationId)
                        : emailPlansHref(null, organizationId, data.product)
                    }
                  >
                    {planChange ? t.billing.workspaces.changePlan : c.browsePlans}
                    <Icon name="arrow-up-right" />
                  </Link>
                </Button>
              </>
            }
          >
            {activeTab === "usage" ? (
              <MailPlanUsage data={data} />
            ) : activeTab === "payment" ? (
              <section className="space-y-4 rounded-2xl bg-card p-5">
                <h2 className="text-lg font-medium">{t.billing.tabs.payment}</h2>
                <OpenStripePortalButton
                  enabled
                  openPortalUrl={
                    serviceId
                      ? () => managedMailApi.order(serviceId, "portal")
                      : managedMailApi.portal
                  }
                />
              </section>
            ) : (
              <section className="space-y-4 rounded-2xl bg-card p-5">
                <h2 className="text-lg font-medium">{c.title}</h2>
                {(plan || data.service) && (
                  <p className="text-sm text-muted-foreground">
                    {dedicatedWebmail ? (
                      <>
                        {t.emailsAdmin.overview.webmailAt}{" "}
                        <a href={dedicatedWebmail} target="_blank" rel="noopener noreferrer" className="break-all text-foreground hover:underline">
                          {new URL(dedicatedWebmail).host}
                        </a>
                      </>
                    ) : product === "sending" ? c.verifySender : c.includedInboxDescription}
                  </p>
                )}
                <Button asChild variant="secondary">
                  <Link href={mailDashboardHref(serviceId, organizationId)}>
                    {c.openDashboard}
                    <Icon name="arrow-right" />
                  </Link>
                </Button>
              </section>
            )}
            {data.pendingPlan && (
              <Button asChild variant="secondary">
                <Link href={emailPlansHref(data.pendingPlan, organizationId, data.pendingProduct)}>
                  {c.resumeCheckout}
                </Link>
              </Button>
            )}
          </PlanDetailColumns>
        </>
      )}
    </PageContainer>
  );
}

function MailPlanUsage({ data }: { data: ManagedMailSummary }) {
  const { t } = useI18n();
  const service = data.service;
  const id = service && !service.provisioning && data.product !== "sending" ? service.id : undefined;
  const stats = useScopedResource(
    useCallback(() => (id ? mailAdminApi.stats.get(id) : Promise.resolve(null)), [id]),
  );
  const usage = useSendingUsage(!!data.sendingConfigured);
  const sending = (
    <SendingQuotaCard
      compact
      usage={usage.data}
      allowance={data.sendingAllowance ?? data.limits?.recipients}
      inactive={data.sendingConfigured === false}
      loading={usage.loading}
      onRetry={usage.error ? usage.refresh : undefined}
    />
  );
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{t.emails.cloudClient.workspaceAllowance}</h2>
      {data.product === "sending" ? (
        <div className="max-w-sm">{sending}</div>
      ) : (
        <MailStatsCard
          managed
          stats={stats.data}
          limits={data.limits}
          loading={stats.loading}
          sending={sending}
        />
      )}
      {stats.error && (
        <div role="alert" className="text-sm">
          {stats.error}{" "}
          <Button variant="link" onClick={stats.refresh}>
            {t.actions.retry}
          </Button>
        </div>
      )}
    </section>
  );
}
