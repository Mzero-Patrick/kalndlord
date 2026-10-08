import Link from "next/link";
import { formatRwf, type PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";
import { applications, charges, leases, myListings, notices, payments, questions } from "@/lib/data";
import { NoticesList, PaymentsTable, RentPanel } from "@/components/RentPanels";
import { NoticeForm } from "@/components/RentForms";
import { ApplicationsPanel, LeasesPanel, ListingsTable, QuestionsPanel } from "@/components/Panels";

interface LandlordData {
  user: PublicUser;
  listings: number;
  tenants: number;
  pendingApplications: number;
  unansweredQuestions: number;
  collectedThisMonth: number;
  owed: number;
  unpaidBills: number;
}

export default async function LandlordDashboard() {
  const data = await loadDashboard<LandlordData>("LANDLORD");
  const [listings, apps, myLeases, qs, bills, paid, sent] = await Promise.all([
    myListings(), applications(), leases(), questions(), charges(), payments(), notices(),
  ]);
  const mine = listings.filter((l) => l.landlord.id === data.user.id);
  const ownLeases = myLeases.filter((l) => l.landlord.id === data.user.id && l.status === "ACTIVE");
  const tenants = [...new Map(ownLeases.map((l) => [l.tenant.id, l.tenant])).values()];
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
        <div className="card"><div className="muted">Rent collected this month</div><div className="stat">{formatRwf(data.collectedThisMonth)}</div></div>
        <div className="card"><div className="muted">Rent owed</div><div className="stat">{formatRwf(data.owed)}</div><div className="hint">{data.unpaidBills} unpaid bill{data.unpaidBills === 1 ? "" : "s"}</div></div>
      </div>
      <section className="card"><h2>Rent</h2><RentPanel items={bills} viewer="LANDLORD" /></section>
      <section className="card"><h2>Applications</h2><ApplicationsPanel items={apps.filter((a) => mine.some((l) => l.id === a.property.id))} /></section>
      <section className="card"><h2>Questions from tenants</h2><QuestionsPanel items={qs.filter((q) => q.from.id !== data.user.id)} empty="No questions yet." /></section>
      <section className="card"><h2>My listings</h2><ListingsTable items={mine} /></section>
      <section className="card"><h2>Payments received</h2><PaymentsTable items={paid} /></section>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Send a notice to tenants</h2>
        {tenants.length ? <NoticeForm tenants={tenants} everyoneLabel="All my tenants" /> : <p className="muted">You can send notices once you have tenants.</p>}
        {sent.length > 0 && <><h3 style={{ marginBottom: 0 }}>Sent</h3><NoticesList items={sent.slice(0, 10)} sent /></>}
      </section>
      <section className="card"><h2>My tenants</h2><LeasesPanel items={myLeases.filter((l) => l.landlord.id === data.user.id)} viewer="LANDLORD" /></section>
    </main>
  );
}
