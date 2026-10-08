import type { PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";

interface LandlordData {
  user: PublicUser;
  listings: number;
  tenants: number;
  openRequests: number;
}

export default async function LandlordDashboard() {
  const data = await loadDashboard<LandlordData>("LANDLORD");
  return (
    <main className="container stack">
      <h1>Welcome, {data.user.fullName}</h1>
      <div className="grid">
        <div className="card"><div className="muted">My listings</div><div className="stat">{data.listings}</div><div className="hint">Add houses and workshops in step 2</div></div>
        <div className="card"><div className="muted">Tenants</div><div className="stat">{data.tenants}</div></div>
        <div className="card"><div className="muted">Open maintenance requests</div><div className="stat">{data.openRequests}</div></div>
      </div>
    </main>
  );
}
