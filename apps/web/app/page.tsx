import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <h1>Renting made simple in Rwanda</h1>
        <p className="muted">
          Landlords list houses and workshops. Tenants find a place, pay rent with MTN MoMo, Airtel Money
          or card, and report maintenance issues, all in one place.
        </p>
        <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/signup" className="button">Create an account</Link>
          <Link href="/login" className="button secondary">Log in</Link>
        </p>
      </section>
      <section className="grid">
        <div className="card"><h3>Find a space</h3><p className="muted">Browse homes and workshops with clear terms and conditions before you apply.</p></div>
        <div className="card"><h3>Pay rent easily</h3><p className="muted">MTN MoMo, Airtel Money or card, with receipts and reminders.</p></div>
        <div className="card"><h3>Report issues</h3><p className="muted">Send a message or photo to your landlord and follow it until it's fixed.</p></div>
      </section>
    </main>
  );
}
