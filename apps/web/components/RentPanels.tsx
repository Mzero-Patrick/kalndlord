import Link from "next/link";
import { formatPeriod, formatRwf, PAYMENT_METHOD_LABEL, type Notice, type Payment, type RentCharge } from "@kalndlord/shared";
import { recordCash } from "@/app/payment-actions";
import { PayButton } from "./RentForms";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ChargeStatus({ c }: { c: RentCharge }) {
  if (c.status === "PAID") return <span className="badge ok">Paid{c.payment?.method ? ` · ${PAYMENT_METHOD_LABEL[c.payment.method]}` : ""}</span>;
  if (c.overdue) return <span className="badge danger">Overdue</span>;
  return <span className="badge warn">Due {day(c.dueDate)}</span>;
}

// Rent bills. Tenants get a Pay button; landlords and the administrator can
// record cash payments.
export function RentPanel({ items, viewer }: { items: RentCharge[]; viewer: "TENANT" | "LANDLORD" | "ADMIN" }) {
  if (!items.length) return <p className="muted">{viewer === "TENANT" ? "No rent bills yet." : "No rent bills yet. They appear when a tenant moves in."}</p>;
  const sorted = [...items].sort((a, b) => (a.status === b.status ? 0 : a.status === "DUE" ? -1 : 1));
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Month</th>{viewer !== "TENANT" && <th>Tenant</th>}<th>Place</th><th>Amount</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id}>
              <td>{formatPeriod(c.period)}</td>
              {viewer !== "TENANT" && <td>{c.lease.tenant.fullName}</td>}
              <td><Link href={`/listings/${c.lease.property.id}`}>{c.lease.property.title}</Link></td>
              <td>{formatRwf(c.amount)}</td>
              <td><ChargeStatus c={c} /></td>
              <td>
                {c.status === "PAID" && c.payment ? (
                  <Link href={`/receipts/${c.payment.id}`}>Receipt</Link>
                ) : viewer === "TENANT" ? (
                  <PayButton chargeId={c.id} />
                ) : (
                  <form action={recordCash}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="small secondary" title="Mark as paid in cash">Record cash</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentsTable({ items }: { items: Payment[] }) {
  if (!items.length) return <p className="muted">No payments yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Tenant</th><th>For</th><th>Amount</th><th>Method</th><th>Receipt</th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.paidAt ? day(p.paidAt) : "—"}</td>
              <td>{p.tenant.fullName}</td>
              <td>{formatPeriod(p.period)} · {p.property.title}</td>
              <td>{formatRwf(p.amount)}</td>
              <td>{p.method ? PAYMENT_METHOD_LABEL[p.method] : "—"}</td>
              <td><Link href={`/receipts/${p.id}`}>{p.receiptNo}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NoticesList({ items, sent }: { items: Notice[]; sent?: boolean }) {
  if (!items.length) return <p className="muted">{sent ? "You haven't sent any notices yet." : "No notices yet."}</p>;
  return (
    <div className="list">
      {items.map((n) => (
        <div key={n.id} className="stack" style={{ gap: 4 }}>
          <div className="row between"><strong>{n.subject}</strong><span className="hint">{day(n.createdAt)}</span></div>
          <span className="hint">{sent ? `To ${n.recipient.fullName}` : `From ${n.sender.fullName}`}</span>
          <p className="quote">{n.message}</p>
        </div>
      ))}
    </div>
  );
}
