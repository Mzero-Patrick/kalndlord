import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { AuthResponse } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, Muted, Title } from "@/components/ui";

// Forgotten password: a code goes to the phone or email typed in, then the
// code and a new password sign the person back in.
export default function Forgot() {
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const [identifier, setIdentifier] = useState(params.id ?? "");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ error?: string; fields?: Record<string, string> }>({});
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    const res = await api("/auth/forgot", { identifier });
    setBusy(false);
    if (!res.ok) return setState({ error: res.data.error, fields: res.data.fields });
    setState({});
    setSent(true);
  }

  async function reset() {
    setBusy(true);
    const res = await api<AuthResponse>("/auth/reset", { identifier, code, password });
    setBusy(false);
    if (!res.ok) return setState({ error: res.data.error, fields: res.data.fields });
    await signIn(res.data);
    router.replace("/home");
  }

  return (
    <Screen>
      <Title>Reset your password</Title>
      <Banner text={state.error} />
      {!sent ? (
        <>
          <Muted>Enter the phone number or email you signed up with. We'll send a code to it.</Muted>
          <Field label="Phone or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none"
            autoComplete="username" error={state.fields?.identifier} />
          <Button title="Send code" onPress={send} busy={busy} />
        </>
      ) : (
        <>
          <Muted>If {identifier} has an account, a 6-digit code is on its way to it. It works for 10 minutes.</Muted>
          <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6}
            autoComplete="one-time-code" error={state.fields?.code} />
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry
            autoComplete="new-password" hint="At least 8 characters" error={state.fields?.password} />
          <Button title="Save new password" onPress={reset} busy={busy} />
          <Button title="Use a different phone or email" secondary onPress={() => setSent(false)} />
        </>
      )}
    </Screen>
  );
}
