import Link from "next/link";
import { formatRwf, type PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";
import { applications, charges, leases, notices, questions } from "@/lib/data";
import { LeasesPanel, MyApplications, QuestionsPanel } from "@/components/Panels";
import { NoticesList, RentPanel } from "@/components/RentPanels";
import { PayButton } from "@/components/RentForms";

interface TenantData {
  user: PublicUser;
  leases: number;
  pendingApplications: number;
  nextPayment: { amount: number; dueDate: string; chargeId: string } | null;
  openRequests: number;
}

export default async function TenantDashboard() {
  const data = await loadDashboard<TenantData>("TENANT");
  const [apps, myLeases, qs, bills, myNotices] = await Promise.all([
    applications(), leases(), questions(), charges(), notices(),
  ]);
  const next = data.nextPayment;
  return (
    <main className="container stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Welcome, {data.user.fullName}</h1>
        <Link className="button" href="/listings">Find a place</Link>
      </div>
      <div className="grid">
        <div className="card"><div className="muted">My rentals</div><div className="stat">{data.leases}</div></div>
        <div className="card"><div className="muted">Applications waiting</div><div className="stat">{data.pendingApplications}</div></div>
        <div className="card stack" style={{ gap: 6 }}>
          <div className="muted">Next payment</div>
          <div className="stat">{next ? formatRwf(next.amount) : "None"}</div>
          {next && <div className="hint">Due {new Date(next.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</div>}
          {next && <PayButton chargeId={next.chargeId} label="Pay with MoMo, Airtel or card" />}
        </div>
      </div>
      {myNotices.length > 0 && <section className="card"><h2>Notices</h2><NoticesList items={myNotices.slice(0, 5)} /></section>}
      <section className="card"><h2>Rent</h2><RentPanel items={bills} viewer="TENANT" /></section>
      <section className="card"><h2>My rentals</h2><LeasesPanel items={myLeases} viewer="TENANT" /></section>
      <section className="card"><h2>My applications</h2><MyApplications items={apps} /></section>
      <section className="card">
        <div className="row between"><h2>My questions</h2><Link href="/contact">Contact us</Link></div>
        <QuestionsPanel items={qs} empty="No questions yet. Ask a landlord from a listing page, or contact us." />
      </section>
    </main>
  );
}
