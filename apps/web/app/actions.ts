"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DASHBOARD_PATH, type AuthResponse, type RegisterResponse } from "@kalndlord/shared";
import { api, SESSION_COOKIE, setSession } from "@/lib/api";

export interface FormState {
  error?: string;
  fields?: Record<string, string>;
  message?: string;
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

function verifyUrl(r: RegisterResponse) {
  return `/verify?u=${encodeURIComponent(r.userId)}&to=${encodeURIComponent(r.sentTo)}`;
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<RegisterResponse>("/auth/register", {
    body: {
      fullName: text(form, "fullName"),
      phone: text(form, "phone"),
      email: text(form, "email"),
      password: form.get("password"),
      role: text(form, "role"),
      verifyVia: text(form, "verifyVia"),
    },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  redirect(verifyUrl(res.data));
}

export async function verify(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<AuthResponse>("/auth/verify", {
    body: { userId: text(form, "userId"), code: text(form, "code") },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  await setSession(res.data.token);
  redirect(DASHBOARD_PATH[res.data.user.role]);
}

export async function resendCode(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<RegisterResponse>("/auth/resend", { body: { userId: text(form, "userId") } });
  if (!res.ok) return { error: res.data.error };
  return { message: `A new code was sent to ${res.data.sentTo}` };
}

export async function logIn(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<AuthResponse & { needsVerification?: boolean; userId?: string }>("/auth/login", {
    body: { identifier: text(form, "identifier"), password: form.get("password") },
  });
  if (res.status === 403 && res.data.needsVerification && res.data.userId) {
    // Send a fresh code, then continue on the verify page.
    const resend = await api<RegisterResponse>("/auth/resend", { body: { userId: res.data.userId } });
    const to = resend.ok ? resend.data.sentTo : "your phone or email";
    redirect(`/verify?u=${encodeURIComponent(res.data.userId)}&to=${encodeURIComponent(to)}`);
  }
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  await setSession(res.data.token);
  redirect(DASHBOARD_PATH[res.data.user.role]);
}

// Step 1 of a forgotten password: send a code to the phone or email given.
export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const identifier = text(form, "identifier");
  const res = await api("/auth/forgot", { body: { identifier } });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  redirect(`/forgot?id=${encodeURIComponent(identifier!)}`);
}

// Step 2: the code and a new password; signs the person in.
export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<AuthResponse>("/auth/reset", {
    body: { identifier: text(form, "identifier"), code: text(form, "code"), password: form.get("password") },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  await setSession(res.data.token);
  redirect(DASHBOARD_PATH[res.data.user.role]);
}

export async function logOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
