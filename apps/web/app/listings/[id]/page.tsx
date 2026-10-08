import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRwf, PROPERTY_TYPE_LABEL, type Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { StatusBadge } from "@/components/Badge";
import { ApplyForm, QuestionForm } from "@/components/ActionForms";

interface Detail {
  listing: Listing;
  myApplication: { id: string; status: string } | null;
  canManage: boolean;
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, user] = await Promise.all([api<Detail>(`/listings/${id}`), currentUser()]);
  if (!res.ok) notFound();
  const { listing: l, myApplication, canManage } = res.data;
  const facts = [
    PROPERTY_TYPE_LABEL[l.type],
    l.bedrooms != null ? `${l.bedrooms} bedroom${l.bedrooms === 1 ? "" : "s"}` : null,
    l.sizeSqm ? `${l.sizeSqm} m²` : null,
    l.deposit ? `Deposit ${formatRwf(l.deposit)}` : null,
  ].filter(Boolean);

  return (
    <main className="container stack">
      <Link href="/listings">← All places</Link>
      <div className="row between">
        <h1 style={{ margin: 0 }}>{l.title}</h1>
        {l.status !== "AVAILABLE" && <StatusBadge status={l.status} />}
      </div>
      <p className="muted" style={{ margin: 0 }}>{l.sector}, {l.district}{l.address ? ` · ${l.address}` : ""} · Listed by {l.landlord.fullName}</p>

      <div className="detail">
        <div className="stack">
          {l.photos.length > 0 && (
            <div className="gallery">
              {l.photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.url} alt={`${l.title} photo ${i + 1}`} className={i === 0 ? "main" : ""} />
              ))}
            </div>
          )}
          <div className="card stack">
            <div className="price">{formatRwf(l.monthlyRent)} <span className="muted" style={{ fontWeight: 400 }}>/ month</span></div>
            <div className="muted">{facts.join(" · ")}</div>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{l.description}</p>
          </div>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Terms and conditions</h2>
            <div className="terms">{l.terms}</div>
          </div>
        </div>

        <aside className="stack">
          {canManage ? (
            <div className="card stack">
              <strong>You manage this listing</strong>
              <Link className="button" href={`/dashboard/listings/${l.id}`}>Edit listing and photos</Link>
            </div>
          ) : !user ? (
            <div className="card stack">
              <strong>Interested?</strong>
              <p className="muted" style={{ margin: 0 }}>Log in or create a tenant account to apply or ask a question.</p>
              <Link className="button" href="/login">Log in</Link>
              <Link className="button secondary" href="/signup">Create an account</Link>
            </div>
          ) : (
            <>
              {user.role === "TENANT" && (
                <div className="card stack">
                  <h2 style={{ margin: 0 }}>Apply</h2>
                  {myApplication && myApplication.status !== "WITHDRAWN" && myApplication.status !== "REJECTED" ? (
                    <p className="muted">Your application: <StatusBadge status={myApplication.status} /> <Link href="/dashboard/tenant">See it in your dashboard</Link></p>
                  ) : l.status === "AVAILABLE" ? (
                    <ApplyForm listingId={l.id} />
                  ) : (
                    <p className="muted">This place is no longer available.</p>
                  )}
                </div>
              )}
              <div className="card stack">
                <h2 style={{ margin: 0 }}>Ask the landlord</h2>
                <QuestionForm propertyId={l.id} compact />
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
