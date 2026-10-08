import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/VerifyForm";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ u?: string; to?: string }> }) {
  const { u, to } = await searchParams;
  if (!u) redirect("/signup");
  return (
    <main className="container narrow">
      <h1>Verify your account</h1>
      <p className="muted">We sent a 6-digit code to {to ?? "your phone or email"}. It expires in 10 minutes.</p>
      <div className="card"><VerifyForm userId={u} /></div>
    </main>
  );
}
