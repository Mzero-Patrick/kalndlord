import Link from "next/link";
import { formatRwf, PROPERTY_TYPE_LABEL, type Listing } from "@kalndlord/shared";

export function ListingCard({ listing }: { listing: Listing }) {
  const cover = listing.photos[0];
  return (
    <Link href={`/listings/${listing.id}`} className="card listing-card">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cover" src={cover.url} alt="" />
      ) : (
        <div className="cover empty">No photo yet</div>
      )}
      <div className="body">
        <span className="muted small" style={{ padding: 0 }}>
          {PROPERTY_TYPE_LABEL[listing.type]} · {listing.sector}, {listing.district}
        </span>
        <strong>{listing.title}</strong>
        <span className="price">{formatRwf(listing.monthlyRent)} <span className="muted" style={{ fontWeight: 400, fontSize: "0.9rem" }}>/ month</span></span>
      </div>
    </Link>
  );
}
