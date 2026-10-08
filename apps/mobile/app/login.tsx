import { useState } from "react";
import { router } from "expo-router";
import type { AuthResponse, RegisterResponse } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, Title } from "@/components/ui";

export default function Login() {
  const { signIn } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await api<AuthResponse & { needsVerification?: boolean; userId?: string }>("/auth/login", { identifier, password });
    if (res.status === 403 && res.data.needsVerification && res.data.userId) {
      const resend = await api<RegisterResponse>("/auth/resend", { userId: res.data.userId });
      setBusy(false);
      router.replace({ pathname: "/verify", params: { u: res.data.userId, to: resend.ok ? resend.data.sentTo : undefined } });
      return;
    }
    setBusy(false);
    if (!res.ok) return setError(res.data.error);
    await signIn(res.data);
    router.replace("/home");
  }

  return (
    <Screen>
      <Title>Log in</Title>
      <Banner text={error} />
      <Field label="Phone or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoComplete="username" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      <Button title="Log in" onPress={submit} busy={busy} />
      <Button title="Create an account" secondary onPress={() => router.replace("/signup")} />
    </Screen>
  );
}
