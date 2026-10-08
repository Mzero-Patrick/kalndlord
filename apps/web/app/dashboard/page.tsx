import { redirect } from "next/navigation";
import { DASHBOARD_PATH } from "@kalndlord/shared";
import { currentUser } from "@/lib/session";

export default async function DashboardIndex() {
  const user = await currentUser();
  redirect(user ? DASHBOARD_PATH[user.role] : "/login");
}
