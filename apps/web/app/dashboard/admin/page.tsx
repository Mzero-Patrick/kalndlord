import type { PublicUser } from "@kalndlord/shared";
import { loadDashboard } from "@/lib/session";

interface AdminData {
  users: Partial<Record<"ADMIN" | "LANDLORD" | "TENANT", number>>;
  recentUsers: PublicUser[];
}

export default async function AdminDashboard() {
  const data = await loadDashboard<AdminData>("ADMIN");
  return (
    <main className="container stack">
      <h1>Administrator dashboard</h1>
      <div className="grid">
        <div className="card"><div className="muted">Landlords</div><div className="stat">{data.users.LANDLORD ?? 0}</div></div>
        <div className="card"><div className="muted">Tenants</div><div className="stat">{data.users.TENANT ?? 0}</div></div>
        <div className="card"><div className="muted">Listings</div><div className="stat">0</div><div className="hint">Coming in step 2</div></div>
        <div className="card"><div className="muted">Rent collected</div><div className="stat">RWF 0</div><div className="hint">Coming in step 3</div></div>
      </div>
      <div className="card">
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
      </div>
    </main>
  );
}
