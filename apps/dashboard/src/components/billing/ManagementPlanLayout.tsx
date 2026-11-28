"use client";

import type { ReactNode } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { useI18n } from "@/components/i18n-provider";
import { PlanDetailHeader } from "./PlanDetailLayout";

export function ManagementPlanLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <PageContainer className="space-y-6">
      <PlanDetailHeader title="OpenShip Manage" description={t.billing.managementPlans.description} />
      {children}
    </PageContainer>
  );
}
