import crypto from "node:crypto";
import { mobileNetworkOf, normalizeRwandaPhone, type PaymentMethod } from "@kalndlord/shared";

export interface CheckoutRequest {
  txRef: string;
  amount: number;
  title: string;
  redirectUrl: string;
  customer: { name: string; email: string; phone: string | null };
}

export interface VerifyResult {
  status: "successful" | "failed" | "pending";
  amount?: number;
  currency?: string;
  providerRef?: string;
  method?: PaymentMethod;
}

// A payment provider. Tenants are sent to its hosted page, where they choose
// MTN MoMo, Airtel Money or card; the result is then confirmed server-side.
export interface PaymentGateway {
  name: string;
  createCheckout(req: CheckoutRequest): Promise<{ url: string }>;
  verify(txRef: string): Promise<VerifyResult>;
  // Returns the transaction reference from a trusted webhook call, or null.
  webhookTxRef(headers: Record<string, string | string[] | undefined>, body: unknown): string | null;
}

// Flutterwave Standard checkout (supports Rwanda mobile money and cards).
export function flutterwave(secretKey: string, webhookHash: string | undefined): PaymentGateway {
  const base = "https://api.flutterwave.com/v3";
  const headers = { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" };
  return {
    name: "flutterwave",
    async createCheckout(req) {
      const res = await fetch(`${base}/payments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tx_ref: req.txRef,
          amount: req.amount,
          currency: "RWF",
          redirect_url: req.redirectUrl,
          payment_options: "mobilemoneyrwanda,card",
          customer: { email: req.customer.email, name: req.customer.name, phonenumber: req.customer.phone ?? undefined },
          customizations: { title: "Kalndlord rent", description: req.title },
        }),
      });
      const json = (await res.json().catch(() => null)) as { status?: string; data?: { link?: string } } | null;
      if (!res.ok || json?.status !== "success" || !json.data?.link) {
        throw new Error(`Flutterwave checkout failed with status ${res.status}`);
      }
      return { url: json.data.link };
    },
    async verify(txRef) {
      const res = await fetch(`${base}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, { headers });
      if (res.status === 404) return { status: "pending" };
      const json = (await res.json().catch(() => null)) as {
        status?: string;
        data?: { status?: string; amount?: number; currency?: string; id?: number; payment_type?: string; customer?: { phone_number?: string } };
      } | null;
      const d = json?.data;
      if (!res.ok || !d) return { status: "pending" };
      const status = d.status === "successful" ? "successful" : d.status === "failed" ? "failed" : "pending";
      let method: PaymentMethod = "OTHER";
      if (d.payment_type?.includes("card")) method = "CARD";
      else if (d.payment_type?.includes("mobilemoney")) {
        const phone = d.customer?.phone_number ? normalizeRwandaPhone(d.customer.phone_number) : null;
        method = (phone && mobileNetworkOf(phone)) || "OTHER";
      }
      return { status, amount: d.amount, currency: d.currency, providerRef: d.id ? String(d.id) : undefined, method };
    },
    webhookTxRef(hdrs, body) {
      const given = hdrs["verif-hash"];
      if (!webhookHash || typeof given !== "string") return null;
      const a = Buffer.from(given);
      const b = Buffer.from(webhookHash);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      const txRef = (body as { data?: { tx_ref?: string } })?.data?.tx_ref;
      return typeof txRef === "string" ? txRef : null;
    },
  };
}

// For development and demos: a local page stands in for the provider, with
// buttons to pay with MTN, Airtel or card, or to fail. No money moves.
export function sandbox(publicUrl: string): PaymentGateway & { complete(txRef: string, outcome: SandboxOutcome): void } {
  const outcomes = new Map<string, { status: "successful" | "failed"; method?: PaymentMethod; amount: number }>();
  const amounts = new Map<string, number>();
  return {
    name: "sandbox",
    async createCheckout(req) {
      amounts.set(req.txRef, req.amount);
      const q = new URLSearchParams({ redirect: req.redirectUrl, amount: String(req.amount), title: req.title });
      return { url: `${publicUrl}/payments/sandbox/${encodeURIComponent(req.txRef)}?${q}` };
    },
    async verify(txRef) {
      const o = outcomes.get(txRef);
      if (!o) return { status: "pending" };
      return { status: o.status, amount: o.amount, currency: "RWF", providerRef: `SBX-${txRef}`, method: o.method };
    },
    webhookTxRef: () => null,
    complete(txRef, outcome) {
      const amount = amounts.get(txRef) ?? 0;
      outcomes.set(txRef, outcome === "FAIL" ? { status: "failed", amount } : { status: "successful", method: outcome, amount });
    },
  };
}

export type SandboxOutcome = "MTN" | "AIRTEL" | "CARD" | "FAIL";

// Online payment switched off: the pay endpoint refuses before calling this.
export const paymentsOff: PaymentGateway = {
  name: "off",
  createCheckout: async () => {
    throw new Error("Online payment is off");
  },
  verify: async () => ({ status: "pending" }),
  webhookTxRef: () => null,
};
