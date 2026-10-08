"use client";

import { useActionState } from "react";
import { logIn, type FormState } from "@/app/actions";
import { FieldError } from "./Field";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(logIn, {});
  return (
    <form action={action} className="stack">
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      <label>
        Phone or email
        <input name="identifier" autoComplete="username" required />
        <FieldError fields={state.fields} name="identifier" />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
    </form>
  );
}
