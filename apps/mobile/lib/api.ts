import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "kalndlord_session";

export type ApiData<T> = T & { error?: string; fields?: Record<string, string> };

export async function api<T>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: ApiData<T> }> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({ error: "Unexpected response from the server" }));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach Kalndlord. Check your connection" } as ApiData<T> };
  }
}

export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
