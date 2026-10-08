import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <main className="container narrow">
      <h1>Create your account</h1>
      <div className="card"><SignupForm /></div>
      <p className="muted">Already have an account? <Link href="/login">Log in</Link></p>
    </main>
  );
}
