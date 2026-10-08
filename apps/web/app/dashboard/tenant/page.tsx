import type { PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";

interface TenantData {
  user: PublicUser;
  leases: number;
  nextPayment: { amount: number; dueDate: string } | null;
  openRequests: number;
}

export default async function TenantDashboard() {
  const data = await loadDashboard<TenantData>("TENANT");
  return (
    <main className="container stack">
      <h1>Welcome, {data.user.fullName}</h1>
      <div className="grid">
        <div className="card"><div className="muted">My rentals</div><div className="stat">{data.leases}</div><div className="hint">Browse spaces in step 2</div></div>
        <div className="card"><div className="muted">Next payment</div><div className="stat">{data.nextPayment ? `RWF ${data.nextPayment.amount}` : "None"}</div></div>
        <div className="card"><div className="muted">My reports</div><div className="stat">{data.openRequests}</div></div>
      </div>
    </main>
  );
}
