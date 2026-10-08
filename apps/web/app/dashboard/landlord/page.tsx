import Link from "next/link";
import type { PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";
import { applications, leases, myListings, questions } from "@/lib/data";
import { ApplicationsPanel, LeasesPanel, ListingsTable, QuestionsPanel } from "@/components/Panels";

interface LandlordData {
  user: PublicUser;
  listings: number;
  tenants: number;
  pendingApplications: number;
  unansweredQuestions: number;
}

export default async function LandlordDashboard() {
  const data = await loadDashboard<LandlordData>("LANDLORD");
  const [listings, apps, myLeases, qs] = await Promise.all([myListings(), applications(), leases(), questions()]);
  const mine = listings.filter((l) => l.landlord.id === data.user.id);
  return (
    <main className="container stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Welcome, {data.user.fullName}</h1>
        <Link className="button" href="/dashboard/listings/new">List a place</Link>
      </div>
      <div className="grid">
        <div className="card"><div className="muted">My listings</div><div className="stat">{data.listings}</div></div>
        <div className="card"><div className="muted">Tenants</div><div className="stat">{data.tenants}</div></div>
        <div className="card"><div className="muted">Applications waiting</div><div className="stat">{data.pendingApplications}</div></div>
        <div className="card"><div className="muted">Questions to answer</div><div className="stat">{data.unansweredQuestions}</div></div>
      </div>
      <section className="card"><h2>Applications</h2><ApplicationsPanel items={apps.filter((a) => mine.some((l) => l.id === a.property.id))} /></section>
      <section className="card"><h2>Questions from tenants</h2><QuestionsPanel items={qs.filter((q) => q.from.id !== data.user.id)} empty="No questions yet." /></section>
      <section className="card"><h2>My listings</h2><ListingsTable items={mine} /></section>
      <section className="card"><h2>My tenants</h2><LeasesPanel items={myLeases.filter((l) => l.landlord.id === data.user.id)} viewer="LANDLORD" /></section>
    </main>
  );
}
