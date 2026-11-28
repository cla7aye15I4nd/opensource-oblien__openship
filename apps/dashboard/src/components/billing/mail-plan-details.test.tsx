// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { I18nProvider } from "@/components/i18n-provider";
import { MailPlanDetails } from "./MailPlanDetails";
import type { PlanDetailTab } from "@/lib/billing-links";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api: { get: h.get, post: h.post },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace }),
  usePathname: () => "/resources",
}));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { id: "test-user" }, session: { activeOrganizationId: "org-a" } },
  }),
}));

const business = {
  plan: "business",
  product: "mailboxes",
  service: null,
  limits: { recipients: 75000, domains: 100, mailboxes: 15, storageMB: 4096 },
};
let host: HTMLDivElement, root: Root;
const render = (tab?: PlanDetailTab, serviceId?: string) =>
  act(async () =>
    root.render(
      <I18nProvider>
        <MailPlanDetails
          resource={{ product: "email", organizationId: "org-a", serviceId }}
          tab={tab}
        />
      </I18nProvider>,
    ),
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("opens a granted plan with its actual allowances and takes the owner to their dashboard", async () => {
  h.get.mockResolvedValue(business);
  await render();
  expect(h.get).toHaveBeenCalledExactlyOnceWith("mail/managed");
  expect(host.querySelector("h1")?.textContent).toBe("OpenShip Mail · Business");
  expect(host.querySelector("aside")?.textContent).toContain("75,000");
  expect(host.querySelector('a[href="/emails?hosting=cloud&organizationId=org-a"]')).not.toBeNull();
  expect(host.querySelector('a[href*="tab=payment"]')).toBeNull();
  expect(host.querySelector('a[href*="changeMail"]')).toBeNull();
  const usage = host.querySelector<HTMLAnchorElement>('a[href*="tab=usage"]')!;
  await act(async () => usage.click());
  expect(h.replace).toHaveBeenCalledWith(
    "/resources?product=email&organizationId=org-a&tab=usage",
    { scroll: false },
  );
  expect(h.post).not.toHaveBeenCalled();
});

it.each([
  [undefined, "account", "mail/managed", "mail/managed/portal"],
  [
    "engine & 1",
    "engine & 1",
    "mail/managed/services/engine%20%26%201",
    "mail/managed/services/engine%20%26%201/portal",
  ],
] as const)(
  "uses the selected subscription for plan changes and the billing portal (%s)",
  async (id, target, endpoint, portal) => {
    h.get.mockResolvedValue({
      ...business,
      product: id ? "dedicated" : "mailboxes",
      hasBillingAccount: !id,
      subscriptionTarget: target,
    });
    await render("payment", id);
    expect(h.get).toHaveBeenCalledWith(endpoint);
    const change = host.querySelector<HTMLAnchorElement>('a[href*="changeMail="]')!;
    expect(new URL(change.href).searchParams.get("changeMail")).toBe(target);
    expect(h.post).not.toHaveBeenCalled();
    h.post.mockRejectedValue(new Error("Portal unavailable"));
    await act(async () => host.querySelector("button")!.click());
    expect(h.post).toHaveBeenCalledExactlyOnceWith(portal);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Portal unavailable");
  },
);

it("displays send-only usage without requesting mailbox statistics", async () => {
  h.get.mockImplementation(async (path) =>
    path === "mail/managed"
      ? { ...business, product: "sending", sendingConfigured: true }
      : { usedPeriod: 12, reservedPeriod: 1, policy: { period: 75000 } },
  );
  await render("usage");
  expect(h.get.mock.calls.map(([path]) => path)).toEqual(["mail/managed", "mail/sending/usage"]);
  expect(host.querySelector('[aria-label="Monthly sending"]')?.textContent).toContain("12/ 75,000");
  expect(host.querySelector("aside")?.textContent).not.toContain("Mailboxes");
});

it("keeps an unavailable service scoped while retrying", async () => {
  h.get.mockRejectedValueOnce(new Error("Service unavailable")).mockResolvedValue(business);
  await render(undefined, "engine-b");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Service unavailable");
  await act(async () => host.querySelector("button")!.click());
  expect(h.get.mock.calls).toEqual([
    ["mail/managed/services/engine-b"],
    ["mail/managed/services/engine-b"],
  ]);
});
