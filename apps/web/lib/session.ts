import "server-only";
import { redirect } from "next/navigation";
import { DASHBOARD_PATH, type PublicUser, type Role } from "@kalndlord/shared";
import { api, getToken } from "./api";

export async function currentUser(): Promise<PublicUser | null> {
  const token = await getToken();
  if (!token) return null;
  const res = await api<{ user: PublicUser }>("/auth/me", { token });
  return res.ok ? res.data.user : null;
}

// Fetches a role's dashboard data, sending the visitor to login or to their own
// dashboard when they don't belong here.
export async function loadDashboard<T>(role: Role): Promise<T> {
  const token = await getToken();
  if (!token) redirect("/login");
  const res = await api<T>(`/dashboard/${role.toLowerCase()}`, { token });
  if (res.status === 401) redirect("/login");
  if (res.status === 403) {
    const user = await currentUser();
    redirect(user ? DASHBOARD_PATH[user.role] : "/login");
  }
  if (!res.ok) throw new Error(res.data.error ?? "Could not load the dashboard");
  return res.data;
}
