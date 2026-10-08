import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { ListingForm } from "@/components/ListingForm";

export default async function NewListingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "TENANT") redirect("/dashboard/tenant");
  const landlords =
    user.role === "ADMIN"
      ? ((await api<{ landlords: { id: string; fullName: string }[] }>("/dashboard/admin")).data.landlords ?? [])
      : undefined;
  return (
    <main className="container stack" style={{ maxWidth: 760 }}>
      <h1>List a place</h1>
      <p className="muted">After saving you can add photos.</p>
      <div className="card"><ListingForm landlords={landlords} /></div>
    </main>
  );
}
