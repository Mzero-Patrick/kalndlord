"use client";

import { useActionState } from "react";
import { requestReset, resetPassword, type FormState } from "@/app/actions";
import { FieldError } from "./Field";

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, {});
  return (
    <form action={action} className="stack">
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      <label>
        Phone or email
        <input name="identifier" autoComplete="username" required />
        <FieldError fields={state.fields} name="identifier" />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Sending…" : "Send code"}</button>
    </form>
  );
}

export function ResetForm({ identifier }: { identifier: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="stack">
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      <input type="hidden" name="identifier" value={identifier} />
      <label>
        Code
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        <FieldError fields={state.fields} name="code" />
      </label>
      <label>
        New password <span className="hint">At least 8 characters</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
        <FieldError fields={state.fields} name="password" />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
