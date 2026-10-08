import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPeriod, formatRwf, PAYMENT_METHOD_LABEL, type Payment } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { currentUser } from "@/lib/session";

// Where the payment page sends tenants back. The result is confirmed with the
// payment provider here, never taken from the address bar.
export default async function PaymentResult({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!ref) redirect("/dashboard/tenant");
  const res = await api<{ payment: Payment }>("/payments/verify", { body: { txRef: ref } });
  const p = res.ok ? res.data.payment : null;

  return (
    <main className="container narrow stack">
      {!p ? (
        <>
          <h1>Payment not found</h1>
          <div className="alert">{res.data.error}</div>
        </>
      ) : p.status === "SUCCESSFUL" ? (
        <>
          <h1>Payment received</h1>
          <div className="notice">
            {formatRwf(p.amount)} for {formatPeriod(p.period)} rent at {p.property.title}
            {p.method ? `, paid with ${PAYMENT_METHOD_LABEL[p.method]}` : ""}. Receipt {p.receiptNo}.
          </div>
          <Link className="button" href={`/receipts/${p.id}`}>View receipt</Link>
        </>
      ) : p.status === "FAILED" ? (
        <>
          <h1>Payment didn't go through</h1>
          <div className="alert">Nothing was taken for this bill. You can try again from your dashboard.</div>
        </>
      ) : (
        <>
          <h1>Waiting for confirmation</h1>
          <p className="muted">
            If you approved the payment on your phone, it can take a minute to confirm. Refresh this page, or check
            your dashboard shortly. You'll also get a message when it's confirmed.
          </p>
          <Link className="button secondary" href={`/payments/result?ref=${encodeURIComponent(ref)}`}>Check again</Link>
        </>
      )}
      <Link href="/dashboard/tenant">Back to my dashboard</Link>
    </main>
  );
}
