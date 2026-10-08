"use client";

import { useActionState } from "react";
import { resendCode, verify, type FormState } from "@/app/actions";
import { FieldError } from "./Field";

export function VerifyForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(verify, {});
  const [resend, resendAction, resending] = useActionState<FormState, FormData>(resendCode, {});
  return (
    <div className="stack">
      <form action={action} className="stack">
        {state.error && <div className="alert" role="alert">{state.error}</div>}
        <input type="hidden" name="userId" value={userId} />
        <label>
          6-digit code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
          <FieldError fields={state.fields} name="code" />
        </label>
        <button type="submit" disabled={pending}>{pending ? "Checking…" : "Verify"}</button>
      </form>
      <form action={resendAction} className="stack">
        <input type="hidden" name="userId" value={userId} />
        {resend.message && <div className="notice">{resend.message}</div>}
        {resend.error && <div className="alert">{resend.error}</div>}
        <button className="secondary" type="submit" disabled={resending}>Send a new code</button>
      </form>
    </div>
  );
}
