"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import { payCharge, sendNotice } from "@/app/payment-actions";
import { FieldError } from "./Field";

export function PayButton({ chargeId, label = "Pay now" }: { chargeId: string; label?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(payCharge, {});
  return (
    <form action={action} className="stack" style={{ gap: 6 }}>
      <input type="hidden" name="id" value={chargeId} />
      <button type="submit" className="small" disabled={pending}>{pending ? "Opening payment…" : label}</button>
      {state.error && <span className="field-error">{state.error}</span>}
    </form>
  );
}

export function NoticeForm({ tenants, everyoneLabel }: { tenants: { id: string; fullName: string }[]; everyoneLabel: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendNotice, {});
  return (
    <form action={action} className="stack" key={state.message}>
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      {state.message && <div className="notice" role="status">{state.message}</div>}
      <label>
        To
        <select name="to" defaultValue="ALL">
          <option value="ALL">{everyoneLabel}</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </select>
        <FieldError fields={state.fields} name="to" />
      </label>
      <label>
        Subject
        <input name="subject" required maxLength={120} placeholder="e.g. Water cut on Monday" />
        <FieldError fields={state.fields} name="subject" />
      </label>
      <label>
        Message <span className="hint">Sent by SMS or email, and shown in their dashboard</span>
        <textarea name="message" required maxLength={2000} />
        <FieldError fields={state.fields} name="message" />
      </label>
      <div><button type="submit" disabled={pending}>{pending ? "Sending…" : "Send notice"}</button></div>
    </form>
  );
}
