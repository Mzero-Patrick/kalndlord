import Link from "next/link";
import { ForgotForm, ResetForm } from "@/components/ResetForms";

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <main className="container narrow">
      <h1>Reset your password</h1>
      <div className="card stack">
        {id ? (
          <>
            <p className="muted" style={{ margin: 0 }}>
              If <strong>{id}</strong> has an account, a 6-digit code is on its way to it. It works for 10 minutes.
            </p>
            <ResetForm identifier={id} />
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: 0 }}>Enter the phone number or email you signed up with. We'll send a code to it.</p>
            <ForgotForm />
          </>
        )}
      </div>
      <p className="muted">
        {id ? <Link href="/forgot">Use a different phone or email</Link> : <Link href="/login">Back to log in</Link>}
      </p>
    </main>
  );
}
