"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { FormState } from "./actions";

const WEB_URL = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

// Starts a payment and sends the tenant to the payment page (MoMo, Airtel or card).
export async function payCharge(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<{ checkoutUrl: string }>(`/charges/${text(form, "id")}/pay`, {
    body: { redirectUrl: `${WEB_URL}/payments/result` },
  });
  if (!res.ok) return { error: res.data.error };
  redirect(res.data.checkoutUrl);
}

export async function recordCash(form: FormData) {
  await api(`/charges/${text(form, "id")}/cash`, { body: { note: text(form, "note") } });
  revalidatePath("/", "layout");
}

export async function sendNotice(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<{ sent: number }>("/notices", {
    body: { to: text(form, "to"), subject: text(form, "subject"), message: text(form, "message") },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  revalidatePath("/", "layout");
  return { message: `Sent to ${res.data.sent} tenant${res.data.sent === 1 ? "" : "s"}` };
}
