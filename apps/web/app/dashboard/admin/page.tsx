import Link from "next/link";
import type { PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";
import { applications, myListings, questions } from "@/lib/data";
import { ApplicationsPanel, ListingsTable, QuestionsPanel } from "@/components/Panels";

interface AdminData {
  users: Partial<Record<"ADMIN" | "LANDLORD" | "TENANT", number>>;
  recentUsers: PublicUser[];
  listings: number;
  pendingApplications: number;
  activeLeases: number;
  unansweredQuestions: number;
}

export default async function AdminDashboard() {
  const data = await loadDashboard<AdminData>("ADMIN");
  const [listings, apps, qs] = await Promise.all([myListings(), applications(), questions()]);
  return (
    <main className="container stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>Administrator dashboard</h1>
        <Link className="button" href="/dashboard/listings/new">Add a listing</Link>
      </div>
      <div className="grid">
        <div className="card"><div className="muted">Landlords</div><div className="stat">{data.users.LANDLORD ?? 0}</div></div>
        <div className="card"><div className="muted">Tenants</div><div className="stat">{data.users.TENANT ?? 0}</div></div>
        <div className="card"><div className="muted">Listings</div><div className="stat">{data.listings}</div></div>
        <div className="card"><div className="muted">Active rentals</div><div className="stat">{data.activeLeases}</div></div>
        <div className="card"><div className="muted">Applications waiting</div><div className="stat">{data.pendingApplications}</div></div>
        <div className="card"><div className="muted">Unanswered questions</div><div className="stat">{data.unansweredQuestions}</div></div>
      </div>
      <section className="card"><h2>Questions</h2><QuestionsPanel items={qs} empty="No questions yet." /></section>
      <section className="card"><h2>Applications</h2><ApplicationsPanel items={apps} /></section>
      <section className="card"><h2>All listings</h2><ListingsTable items={listings} /></section>
      <section className="card">
        <h2>Newest accounts</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              {data.recentUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.role.toLowerCase()}</td>
                  <td>{u.phone ?? "—"}</td>
                  <td>{u.email ?? "—"}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
