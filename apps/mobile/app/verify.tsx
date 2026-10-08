import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { AuthResponse, RegisterResponse } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, Muted, Title } from "@/components/ui";

export default function Verify() {
  const { u, to } = useLocalSearchParams<{ u: string; to?: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await api<AuthResponse>("/auth/verify", { userId: u, code });
    setBusy(false);
    if (!res.ok) return setError(res.data.error);
    await signIn(res.data);
    router.replace("/home");
  }

  async function resend() {
    const res = await api<RegisterResponse>("/auth/resend", { userId: u });
    if (!res.ok) return setError(res.data.error);
    setError(undefined);
    setNotice(`A new code was sent to ${res.data.sentTo}`);
  }

  return (
    <Screen>
      <Title>Verify your account</Title>
      <Muted>We sent a 6-digit code to {to ?? "your phone or email"}. It expires in 10 minutes.</Muted>
      <Banner text={error} />
      <Banner text={notice} kind="ok" />
      <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
      <Button title="Verify" onPress={submit} busy={busy} />
      <Button title="Send a new code" secondary onPress={resend} />
    </Screen>
  );
}
