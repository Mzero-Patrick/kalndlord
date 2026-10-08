import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "kalndlord_session";

export type ApiData<T> = T & { error?: string; fields?: Record<string, string> };
export type ApiResult<T> = { ok: boolean; status: number; data: ApiData<T> };

export async function api<T>(path: string, body?: unknown, method?: string): Promise<ApiResult<T>> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const isForm = body instanceof FormData;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? {} : await res.json().catch(() => ({ error: "Unexpected response from the server" }));
    return { ok: res.ok, status: res.status, data: data as ApiData<T> };
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach Kalndlord. Check your connection" } as ApiData<T> };
  }
}

export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
