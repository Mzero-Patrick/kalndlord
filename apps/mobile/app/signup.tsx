import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import type { RegisterResponse } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { Banner, Button, Field, Muted, Title, usePalette } from "@/components/ui";

type Role = "TENANT" | "LANDLORD";

export default function Signup() {
  const c = usePalette();
  const [role, setRole] = useState<Role>("TENANT");
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", password: "" });
  const [verifyVia, setVerifyVia] = useState<"PHONE" | "EMAIL">("PHONE");
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setBusy(true);
    const res = await api<RegisterResponse>("/auth/register", {
      fullName: form.fullName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      password: form.password,
      role,
      verifyVia: form.phone && form.email ? verifyVia : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.error);
      setFields(res.data.fields ?? {});
      return;
    }
    router.replace({ pathname: "/verify", params: { u: res.data.userId, to: res.data.sentTo } });
  }

  const pill = (active: boolean) => ({
    flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: "center" as const,
    borderColor: active ? c.brand : c.border,
  });

  return (
    <Screen>
      <Title>Create your account</Title>
      <Banner text={error} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        {(["TENANT", "LANDLORD"] as Role[]).map((r) => (
          <Pressable key={r} style={pill(role === r)} onPress={() => setRole(r)}>
            <Text style={{ color: c.text }}>{r === "TENANT" ? "I'm a tenant" : "I'm a landlord"}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Full name" value={form.fullName} onChangeText={set("fullName")} error={fields.fullName} autoComplete="name" />
      <Field label="Phone number" hint="MTN or Airtel, e.g. 078 123 4567" value={form.phone} onChangeText={set("phone")} error={fields.phone} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Email" hint="Optional if you gave a phone number" value={form.email} onChangeText={set("email")} error={fields.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      {form.phone && form.email ? (
        <View style={{ gap: 6 }}>
          <Muted>Send my verification code by</Muted>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["PHONE", "EMAIL"] as const).map((v) => (
              <Pressable key={v} style={pill(verifyVia === v)} onPress={() => setVerifyVia(v)}>
                <Text style={{ color: c.text }}>{v === "PHONE" ? "SMS" : "Email"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <Field label="Password" hint="At least 8 characters" value={form.password} onChangeText={set("password")} error={fields.password} secureTextEntry autoComplete="new-password" />
      <Button title="Create account" onPress={submit} busy={busy} />
      <Button title="I already have an account" secondary onPress={() => router.replace("/login")} />
    </Screen>
  );
}
