import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Payment } from "@kalndlord/shared";
import { api } from "./api";

// Opens the payment page (MoMo, Airtel or card) in an in-app browser, waits
// for it to send the tenant back, then confirms the result with the API.
export async function payCharge(chargeId: string): Promise<{ payment?: Payment; error?: string }> {
  const returnUrl = Linking.createURL("payments/result");
  const started = await api<{ checkoutUrl: string; txRef: string }>(`/charges/${chargeId}/pay`, { redirectUrl: returnUrl });
  if (!started.ok) return { error: started.data.error };

  await WebBrowser.openAuthSessionAsync(started.data.checkoutUrl, returnUrl);
  // Whether the tenant finished or closed the page, ask the API what happened.
  const res = await api<{ payment: Payment }>("/payments/verify", { txRef: started.data.txRef });
  if (!res.ok) return { error: res.data.error };
  return { payment: res.data.payment };
}
