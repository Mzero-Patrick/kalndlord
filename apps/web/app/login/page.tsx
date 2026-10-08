import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="container narrow">
      <h1>Log in</h1>
      <div className="card"><LoginForm /></div>
      <p className="muted">
        <Link href="/forgot">Forgot your password?</Link> · New here? <Link href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
