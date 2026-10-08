import Link from "next/link";
import { PROPERTY_TYPE_LABEL, PROPERTY_TYPES, RWANDA_DISTRICTS, type Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { ListingCard } from "@/components/ListingCard";

type Search = { q?: string; type?: string; district?: string; minRent?: string; maxRent?: string; page?: string };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const res = await api<{ items: Listing[]; total: number; page: number; pageSize: number }>(`/listings?${query}`);
  const page = res.ok ? res.data.page : 1;
  const pages = res.ok ? Math.max(1, Math.ceil(res.data.total / res.data.pageSize)) : 1;
  const pageLink = (p: number) => `/listings?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`;

  return (
    <main className="container stack">
      <h1>Find a place</h1>
      <form className="card form-grid" method="get">
        <label>Search<input name="q" defaultValue={params.q} placeholder="Area, street, keyword" /></label>
        <label>
          Type
          <select name="type" defaultValue={params.type ?? ""}>
            <option value="">Any</option>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label>
          District
          <select name="district" defaultValue={params.district ?? ""}>
            <option value="">Any</option>
            {RWANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label>Max rent (RWF)<input name="maxRent" type="number" min={0} defaultValue={params.maxRent} /></label>
        <div style={{ alignSelf: "end" }}><button type="submit">Search</button></div>
      </form>

      {!res.ok ? (
        <div className="alert">{res.data.error}</div>
      ) : res.data.items.length === 0 ? (
        <p className="muted">No places match your search yet. Try fewer filters.</p>
      ) : (
        <>
          <p className="muted">{res.data.total} place{res.data.total === 1 ? "" : "s"} available</p>
          <div className="listing-grid">{res.data.items.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
          {pages > 1 && (
            <div className="row">
              {page > 1 && <Link className="button secondary" href={pageLink(page - 1)}>Previous</Link>}
              <span className="muted">Page {page} of {pages}</span>
              {page < pages && <Link className="button secondary" href={pageLink(page + 1)}>Next</Link>}
            </div>
          )}
        </>
      )}
    </main>
  );
}
