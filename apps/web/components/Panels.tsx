import Link from "next/link";
import { formatRwf, type Application, type Inquiry, type Lease, type Listing } from "@kalndlord/shared";
import { decideApplication } from "@/app/listing-actions";
import { StatusBadge } from "./Badge";
import { ReplyForm } from "./ActionForms";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted">{children}</p>;
}

function Decide({ id, decision, label, secondary }: { id: string; decision: string; label: string; secondary?: boolean }) {
  return (
    <form action={decideApplication}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button type="submit" className={`small ${secondary ? "secondary" : ""}`}>{label}</button>
    </form>
  );
}

export function ListingsTable({ items }: { items: (Listing & { pendingApplications: number })[] }) {
  if (!items.length) return <Empty>No listings yet.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Listing</th><th>Rent</th><th>Status</th><th>Applications</th><th></th></tr></thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id}>
              <td><Link href={`/listings/${l.id}`}>{l.title}</Link><div className="hint">{l.sector}, {l.district} · {l.landlord.fullName}</div></td>
              <td>{formatRwf(l.monthlyRent)}</td>
              <td><StatusBadge status={l.status} /></td>
              <td>{l.pendingApplications ? `${l.pendingApplications} waiting` : "—"}</td>
              <td><Link href={`/dashboard/listings/${l.id}`}>Edit</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// For landlords and the administrator: decide on applications.
export function ApplicationsPanel({ items }: { items: Application[] }) {
  if (!items.length) return <Empty>No applications yet.</Empty>;
  return (
    <div className="list">
      {items.map((a) => (
        <div key={a.id} className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <strong>{a.tenant.fullName} → <Link href={`/listings/${a.property.id}`}>{a.property.title}</Link></strong>
            <StatusBadge status={a.status} />
          </div>
          <span className="hint">
            {[a.tenant.phone, a.tenant.email].filter(Boolean).join(" · ")} · applied {date(a.createdAt)}
            {a.moveInDate ? ` · move in ${date(a.moveInDate)}` : ""} · accepted the terms
          </span>
          {a.message && <p className="quote">{a.message}</p>}
          {a.status === "PENDING" && (
            <div className="row">
              <Decide id={a.id} decision="accept" label="Accept" />
              <Decide id={a.id} decision="reject" label="Decline" secondary />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// For tenants: their own applications.
export function MyApplications({ items }: { items: Application[] }) {
  if (!items.length) return <Empty>You haven't applied anywhere yet. <Link href="/listings">Browse places</Link>.</Empty>;
  return (
    <div className="list">
      {items.map((a) => (
        <div key={a.id} className="row between">
          <div>
            <Link href={`/listings/${a.property.id}`}>{a.property.title}</Link>
            <div className="hint">{formatRwf(a.property.monthlyRent)} / month · applied {date(a.createdAt)}</div>
          </div>
          <div className="row">
            <StatusBadge status={a.status} />
            {a.status === "PENDING" && <Decide id={a.id} decision="withdraw" label="Withdraw" secondary />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeasesPanel({ items, viewer }: { items: Lease[]; viewer: "TENANT" | "LANDLORD" }) {
  if (!items.length) return <Empty>{viewer === "TENANT" ? "No rentals yet." : "No tenants yet."}</Empty>;
  return (
    <div className="list">
      {items.map((l) => (
        <div key={l.id} className="stack" style={{ gap: 4 }}>
          <div className="row between">
            <Link href={`/listings/${l.property.id}`}>{l.property.title}</Link>
            <StatusBadge status={l.status} />
          </div>
          <span className="hint">
            {formatRwf(l.monthlyRent)} / month · since {date(l.startDate)} · {l.property.sector}, {l.property.district}
          </span>
          <span className="hint">
            {viewer === "TENANT"
              ? `Landlord: ${l.landlord.fullName} · ${[l.landlord.phone, l.landlord.email].filter(Boolean).join(" · ")}`
              : `Tenant: ${l.tenant.fullName}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function QuestionsPanel({ items, empty }: { items: (Inquiry & { canReply?: boolean })[]; empty: string }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <div className="list">
      {items.map((q) => (
        <div key={q.id} className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <strong>{q.subject}</strong>
            <span className={`badge ${q.reply ? "ok" : "warn"}`}>{q.reply ? "Answered" : "Waiting for reply"}</span>
          </div>
          <span className="hint">
            {q.from.fullName} · {date(q.createdAt)} · {q.property ? <Link href={`/listings/${q.property.id}`}>{q.property.title}</Link> : "General question"}
          </span>
          <p className="quote">{q.message}</p>
          {q.reply && <p className="quote" style={{ borderColor: "var(--brand)" }}><strong>Reply:</strong> {q.reply}</p>}
          {q.canReply && <ReplyForm inquiryId={q.id} />}
        </div>
      ))}
    </div>
  );
}
