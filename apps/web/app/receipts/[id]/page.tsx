import { notFound } from "next/navigation";
import { formatPeriod, formatRwf, PAYMENT_METHOD_LABEL, type Payment } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { PrintButton } from "@/components/PrintButton";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await api<{ payment: Payment }>(`/payments/${id}`);
  if (!res.ok) notFound();
  const p = res.data.payment;
  const rows: [string, string][] = [
    ["Receipt number", p.receiptNo ?? "—"],
    ["Date paid", p.paidAt ? new Date(p.paidAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }) : "—"],
    ["Paid by", `${p.tenant.fullName}${p.tenant.phone ? ` (${p.tenant.phone})` : ""}`],
    ["For", `${formatPeriod(p.period)} rent`],
    ["Place", p.property.title],
    ["Landlord", p.landlord.fullName],
    ["Method", p.method ? PAYMENT_METHOD_LABEL[p.method] : "—"],
    ["Reference", p.txRef],
  ];
  if (p.recordedBy) rows.push(["Recorded by", p.recordedBy.fullName]);
  return (
    <main className="container narrow stack">
      <div className="card stack">
        <div className="row between">
          <h1 style={{ margin: 0 }}>Rent receipt</h1>
          <span className="badge ok">Paid</span>
        </div>
        <div className="stat">{formatRwf(p.amount)}</div>
        <table>
          <tbody>{rows.map(([k, v]) => <tr key={k}><th style={{ width: "40%" }}>{k}</th><td>{v}</td></tr>)}</tbody>
        </table>
        <p className="hint">Issued by Kalndlord.</p>
      </div>
      <PrintButton />
    </main>
  );
}
