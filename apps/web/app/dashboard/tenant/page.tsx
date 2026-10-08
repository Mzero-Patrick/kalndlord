import Link from "next/link";
import type { PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";
import { applications, leases, questions } from "@/lib/data";
import { LeasesPanel, MyApplications, QuestionsPanel } from "@/components/Panels";

interface TenantData {
  user: PublicUser;
  leases: number;
  pendingApplications: number;
  nextPayment: { amount: number; dueDate: string } | null;
  openRequests: number;
}

export default async function TenantDashboard() {
  const data = await loadDashboard<TenantData>("TENANT");
  const [apps, myLeases, qs] = await Promise.all([applications(), leases(), questions()]);
  return (
    <main className="container stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Welcome, {data.user.fullName}</h1>
        <Link className="button" href="/listings">Find a place</Link>
      </div>
      <div className="grid">
        <div className="card"><div className="muted">My rentals</div><div className="stat">{data.leases}</div></div>
        <div className="card"><div className="muted">Applications waiting</div><div className="stat">{data.pendingApplications}</div></div>
        <div className="card"><div className="muted">Next payment</div><div className="stat">None</div><div className="hint">Payments come in step 3</div></div>
      </div>
      <section className="card"><h2>My rentals</h2><LeasesPanel items={myLeases} viewer="TENANT" /></section>
      <section className="card"><h2>My applications</h2><MyApplications items={apps} /></section>
      <section className="card">
        <div className="row between"><h2>My questions</h2><Link href="/contact">Contact us</Link></div>
        <QuestionsPanel items={qs} empty="No questions yet. Ask a landlord from a listing page, or contact us." />
      </section>
    </main>
  );
}
