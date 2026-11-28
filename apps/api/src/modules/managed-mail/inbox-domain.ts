import { resolve6 } from "node:dns/promises";
import {
  dedicatedInboxRecords,
  isValidInboxDomain,
  type InboxDnsRequest,
} from "@repo/contracts/managed-mail";
import {
  planRecords,
  provisionRecords,
} from "@repo/platform/engine/modules/dns/dns-credential.service";
import { AppError, mailHostname } from "@repo/core";
import { repos } from "@repo/db";
import { dedicatedCoverage, orderLock } from "@repo/platform/engine/modules/managed-mail/dedicated";
import { enrolledMailEngine } from "@repo/platform/engine/modules/managed-mail/dedicated-fleet";
import { engineIdentity } from "@repo/platform/engine/modules/managed-mail/service";
import { verifyMailDomainOwnership } from "../mail/domain-proof";

async function inboxSetup(org: string, serviceId: string, input: string) {
  const domain = input.trim().toLowerCase();
  const hostname = mailHostname(domain);
  if (!isValidInboxDomain(domain)) throw new AppError("Enter a valid mailbox domain.", 400);

  const row = await repos.managedMail.service(org, serviceId);
  if (!row || row.orderState === "closed") throw new AppError("Mail service not found.", 404);
  const worker = row.order?.worker;
  const dns = worker?.customerDns;
  if (
    !row.order ||
    !worker ||
    !dns ||
    row.orderState !== "funded" ||
    !(await dedicatedCoverage(row))
  )
    throw new AppError("This dedicated server is not ready for domain setup.", 409);
  return { row, order: row.order, worker, dns, domain, hostname };
}

/** Only the paid VM supplies record values. The customer explicitly chooses when to switch MX. */
export async function dedicatedInboxProviderDns(
  org: string,
  serviceId: string,
  input: InboxDnsRequest,
  apply: boolean,
) {
  const { row, dns, domain } = await inboxSetup(org, serviceId, input.domain);
  if (
    input.stage === "setup"
      ? !row.provisioning || dns.domain
      : row.provisioning || dns.domain !== domain
  )
    throw new AppError("Mail setup has changed. Refresh to see the current records.", 409);
  const { ownership, aaaa, mx } = dedicatedInboxRecords(serviceId, domain, dns.ipv6);
  const records = input.stage === "setup" ? [ownership, aaaa] : [aaaa, mx];
  const action = apply ? provisionRecords : planRecords;
  return {
    data: await action(
      org,
      domain,
      records.map(({ value, ...record }) => ({
        ...record,
        content: value,
        ...(record.type === "TXT" && { append: true }),
        ...(record.type === "AAAA" && { proxied: false }),
      })),
    ),
  };
}

export async function configureInboxDomain(org: string, serviceId: string, input: string) {
  return orderLock(org).run(async () => {
    const {
      row,
      order: currentOrder,
      worker,
      dns,
      domain,
      hostname,
    } = await inboxSetup(org, serviceId, input);
    if (dns.domain === domain) return { domain };
    if (dns.domain || row.engine || !row.provisioning)
      throw new AppError("This mail server already has an installation domain.", 409);

    await verifyMailDomainOwnership(serviceId, domain);
    const addresses = await resolve6(hostname).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENODATA" || e.code === "ENOTFOUND") return [];
      throw new AppError("DNS lookup is temporarily unavailable. Try again.", 503);
    });
    const expected = new URL("http://[" + dns.ipv6 + "]").hostname;
    if (
      !addresses.length ||
      addresses.some((ip) => new URL("http://[" + ip + "]").hostname !== expected)
    )
      throw new AppError(
        `Set the AAAA record for ${hostname} to ${dns.ipv6}, then verify again.`,
        409,
      );
    const order = { ...currentOrder, worker: { ...worker, customerDns: { ...dns, domain } } };
    const engine = enrolledMailEngine({ ...row, order });
    if (!engine) throw new AppError("The dedicated worker is temporarily unavailable.", 503);
    if (!(await repos.managedMail.attachVm(row.id, org, engineIdentity(engine), hostname, order)))
      throw new AppError("This mail hostname is already assigned to a server.", 409);
    return { domain };
  });
}
