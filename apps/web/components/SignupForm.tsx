"use client";

import { useActionState } from "react";
import { signUp, type FormState } from "@/app/actions";
import { FieldError } from "./Field";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  const f = state.fields;
  return (
    <form action={action} className="stack">
      {state.error && <div className="alert" role="alert">{state.error}</div>}

      <div className="choice" role="radiogroup" aria-label="I am a">
        <label><input type="radio" name="role" value="TENANT" defaultChecked /> I'm a tenant</label>
        <label><input type="radio" name="role" value="LANDLORD" /> I'm a landlord</label>
      </div>

      <label>
        Full name
        <input name="fullName" autoComplete="name" required />
        <FieldError fields={f} name="fullName" />
      </label>
      <label>
        Phone number <span className="hint">MTN or Airtel, e.g. 078 123 4567</span>
        <input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
        <FieldError fields={f} name="phone" />
      </label>
      <label>
        Email <span className="hint">Optional if you gave a phone number</span>
        <input name="email" type="email" autoComplete="email" />
        <FieldError fields={f} name="email" />
      </label>
      <label>
        Send my verification code by
        <select name="verifyVia" defaultValue="">
          <option value="">SMS if I gave a phone, otherwise email</option>
          <option value="PHONE">SMS</option>
          <option value="EMAIL">Email</option>
        </select>
        <FieldError fields={f} name="verifyVia" />
      </label>
      <label>
        Password <span className="hint">At least 8 characters</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={8} />
        <FieldError fields={f} name="password" />
      </label>

      <button type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}
