"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useI18n } from "@/components/i18n-provider";
import { BillingSupportLink } from "./BillingSupportLink";
import type { PlanDetailTab } from "@/lib/billing-links";

export function PlanDetailHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-medium text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <BillingSupportLink />
      </div>
    </header>
  );
}

export function PlanDetailTabs({
  value,
  href,
  payments = true,
  pending,
  extra = [],
}: {
  value: PlanDetailTab;
  href: (tab: PlanDetailTab) => string;
  payments?: boolean;
  pending?: number;
  extra?: TabDef<PlanDetailTab>[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const tabs: TabDef<PlanDetailTab>[] = [
    { key: "overview", label: t.billing.tabs.overview, icon: "dashboard" },
    { key: "usage", label: t.billing.tabs.usage, icon: "chart-bar" },
    {
      key: "payment",
      label: t.billing.tabs.payment,
      icon: "credit-card",
      count: pending || undefined,
      hidden: !payments,
    },
    ...extra,
  ];
  return (
    <Tabs
      tabs={tabs.map((item) => ({ ...item, href: href(item.key) }))}
      value={value}
      onChange={(next) => router.replace(href(next), { scroll: false })}
      ariaLabel={t.billing.layout.title}
    />
  );
}

export function PlanDetailColumns({
  children,
  summary,
}: {
  children: ReactNode;
  summary: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 @min-[64rem]/resources:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">{children}</div>
      <aside className="min-w-0 space-y-4">{summary}</aside>
    </div>
  );
}
