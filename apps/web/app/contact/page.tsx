import Link from "next/link";
import type { Inquiry } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { QuestionForm } from "@/components/ActionForms";
import { QuestionsPanel } from "@/components/Panels";

export default async function ContactPage() {
  const user = await currentUser();
  const mine = user ? await api<{ items: Inquiry[] }>("/inquiries") : null;
  const sent = mine?.ok ? mine.data.items.filter((q) => q.from.id === user!.id) : [];
  return (
    <main className="container narrow stack">
      <h1>Contact us</h1>
      <p className="muted">
        Need help, or something to raise with the Kalndlord team? Send us a question. For a question about a
        specific place, use "Ask the landlord" on its page instead.
      </p>
      {user ? (
        <>
          <div className="card"><QuestionForm /></div>
          <h2>Your questions</h2>
          <div className="card"><QuestionsPanel items={sent} empty="You haven't asked anything yet." /></div>
        </>
      ) : (
        <div className="card stack">
          <p style={{ margin: 0 }}>Log in so we can reply to you.</p>
          <Link className="button" href="/login">Log in</Link>
        </div>
      )}
    </main>
  );
}
