import { PLAN_IDS, resolvePlan, toPricingLocale } from "@repo/core";

import { planResourceHref, type PlanDetailTab } from "./billing-links";

export type CloudPlanTab = PlanDetailTab;

export function cloudSpaceHref(serverId: string, tab?: CloudPlanTab, params?: URLSearchParams) {
  return planResourceHref({ pool: serverId }, tab, params);
}

/** Use catalog names without silently calling an unknown offer Free. */
export function cloudSpacePlanLabel(planId: string, locale: string, fallback: string) {
  const known = PLAN_IDS.find((id) => id === planId);
  return known ? resolvePlan(known, toPricingLocale(locale)).name : fallback;
}
