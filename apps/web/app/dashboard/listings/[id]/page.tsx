import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DASHBOARD_PATH, type Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { deletePhoto } from "@/app/listing-actions";
import { ListingForm } from "@/components/ListingForm";
import { PhotoUploadForm } from "@/components/ActionForms";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }, user] = await Promise.all([params, searchParams, currentUser()]);
  if (!user) redirect("/login");
  const res = await api<{ listing: Listing; canManage: boolean }>(`/listings/${id}`);
  if (!res.ok || !res.data.canManage) notFound();
  const l = res.data.listing;
  return (
    <main className="container stack" style={{ maxWidth: 760 }}>
      <Link href={DASHBOARD_PATH[user.role]}>← Dashboard</Link>
      <h1 style={{ margin: 0 }}>{l.title}</h1>
      {created && <div className="notice">Listing created. Add a few photos so tenants can see the place.</div>}
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Photos</h2>
        {l.photos.length > 0 ? (
          <div className="gallery">
            {l.photos.map((p) => (
              <div key={p.id} className="photo-tile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" />
                <form action={deletePhoto}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="photoId" value={p.id} />
                  <button type="submit" className="small secondary" style={{ background: "var(--surface)" }}>Remove</button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No photos yet.</p>
        )}
        {l.photos.length < 8 && <PhotoUploadForm listingId={l.id} />}
      </section>
      <section className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Details</h2>
          <Link href={`/listings/${l.id}`}>View public page</Link>
        </div>
        <ListingForm listing={l} />
      </section>
    </main>
  );
}
