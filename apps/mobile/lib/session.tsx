import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthResponse, PublicUser } from "@kalndlord/shared";
import { api, clearToken, saveToken } from "./api";

interface Session {
  user: PublicUser | null;
  loading: boolean;
  signIn: (auth: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: PublicUser }>("/auth/me").then((res) => {
      setUser(res.ok ? res.data.user : null);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (auth: AuthResponse) => {
    await saveToken(auth.token);
    setUser(auth.user);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return <SessionContext.Provider value={{ user, loading, signIn, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
