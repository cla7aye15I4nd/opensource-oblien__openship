"use client";

import { useState } from "react";
import {
  dedicatedInboxRecords,
  isValidInboxDomain,
  type InboxDnsRequest,
} from "@repo/contracts/managed-mail";
import { DnsRecordCard } from "@/components/shared/DnsRecordsView";
import { AutoDnsPanel } from "@/components/shared/AutoDnsPanel";
import { DisclosureSummary } from "@/components/ui/DisclosureSummary";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api";
import { managedMailApi } from "@/lib/api/managed-mail";
import { Field, inputClassName } from "./admin/_shared/form-modal-content";

export function InboxDnsProvider({
  serviceId,
  domain,
  stage,
}: InboxDnsRequest & { serviceId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="text-sm" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <DisclosureSummary className="cursor-pointer py-2 font-medium">
        Configure with a DNS provider
      </DisclosureSummary>
      {open && (
        <AutoDnsPanel
          hostname={domain}
          reloadKey={serviceId + ":" + domain + ":" + stage}
          plan={() => managedMailApi.inboxDnsPlan(serviceId, { domain, stage }).then((r) => r.data)}
          apply={() =>
            managedMailApi.inboxDnsApply(serviceId, { domain, stage }).then((r) => r.data)
          }
        />
      )}
    </details>
  );
}

export function DedicatedInboxSetup({
  serviceId,
  dns,
  onVerified,
}: {
  serviceId: string;
  dns: { ipv6: string; domain?: string };
  onVerified: () => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const domain = dns.domain ?? input.trim().toLowerCase();
  const valid = isValidInboxDomain(domain);
  const records = dedicatedInboxRecords(serviceId, domain, dns.ipv6);

  if (dns.domain)
    return (
      <section className="space-y-3 rounded-2xl bg-card p-5">
        <h2 className="font-medium">Setting up mail for {domain}</h2>
        <p role="status" className="text-sm text-muted-foreground">
          Once your first mailbox is ready, publish this MX record to receive messages on your
          dedicated server.
        </p>
        <DnsRecordCard rec={records.mx} />
      </section>
    );

  return (
    <section className="space-y-4 rounded-2xl bg-card p-5">
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid || busy) return;
          setBusy(true);
          setError("");
          try {
            await managedMailApi.configureInboxDomain(serviceId, domain);
            onVerified();
          } catch (cause) {
            setError(getApiErrorMessage(cause, "Could not verify your DNS records."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Mailbox domain"
          hint="Enter the domain you want after the @ in your email addresses."
        >
          <input
            name="domain"
            className={inputClassName}
            placeholder="example.com"
            value={input}
            disabled={busy}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => {
              setInput(e.target.value);
              setError("");
            }}
          />
        </Field>
        {valid && (
          <>
            <p className="text-sm text-muted-foreground">
              Add these records at your DNS provider. Set the AAAA record to DNS only.
            </p>
            <DnsRecordCard rec={records.ownership} />
            <DnsRecordCard rec={records.aaaa} />
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!valid || busy}>
          {busy ? "Checking DNS…" : "Verify and set up mail"}
        </Button>
      </form>
      {valid && (
        <InboxDnsProvider key={domain} serviceId={serviceId} domain={domain} stage="setup" />
      )}
    </section>
  );
}
