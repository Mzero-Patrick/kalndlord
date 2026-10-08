import "server-only";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:4000";
export const SESSION_COOKIE = "kalndlord_session";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T & { error?: string; fields?: Record<string, string> };
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: "Unexpected response from the server" }));
  return { ok: res.ok, status: res.status, data } as ApiResult<T>;
}

export async function setSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
