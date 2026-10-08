import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container narrow stack">
      <h1>Not found</h1>
      <p className="muted">This page or listing isn't available. It may have been rented out or removed.</p>
      <Link className="button" href="/listings">Browse places</Link>
    </main>
  );
}
