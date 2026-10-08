import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { api } from "@/lib/api";
import { Banner, Button, Field, usePalette } from "./ui";

// Ask a landlord (with propertyId) or the Kalndlord team (without).
export function QuestionForm({ propertyId, onSent }: { propertyId?: string; onSent?: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ error?: string; ok?: string; fields?: Record<string, string> }>({});
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const res = await api("/inquiries", { propertyId, subject, message });
    setBusy(false);
    if (!res.ok) return setState({ error: res.data.error, fields: res.data.fields });
    setSubject("");
    setMessage("");
    setState({ ok: "Question sent. You'll get a message when there's a reply." });
    onSent?.();
  }
  return (
    <View style={{ gap: 10 }}>
      <Banner text={state.error} />
      <Banner text={state.ok} kind="ok" />
      <Field label="Subject" value={subject} onChangeText={setSubject} error={state.fields?.subject} />
      <Field label="Your question" value={message} onChangeText={setMessage} multiline numberOfLines={4}
        style={{ minHeight: 90, textAlignVertical: "top" }} error={state.fields?.message} />
      <Button title="Send question" secondary onPress={send} busy={busy} />
    </View>
  );
}

export function ApplyForm({ listingId, onApplied }: { listingId: string; onApplied: () => void }) {
  const c = usePalette();
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function apply() {
    if (!accepted) return setError("You must accept the terms and conditions");
    setBusy(true);
    const res = await api(`/listings/${listingId}/applications`, { acceptTerms: true, message: message || undefined });
    setBusy(false);
    if (!res.ok) return setError(res.data.error);
    onApplied();
  }
  return (
    <View style={{ gap: 10 }}>
      <Banner text={error} />
      <Field label="Message to the landlord (optional)" value={message} onChangeText={setMessage} multiline
        style={{ minHeight: 80, textAlignVertical: "top" }} />
      <Pressable onPress={() => setAccepted(!accepted)} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Switch value={accepted} onValueChange={setAccepted} />
        <Text style={{ color: c.text, flex: 1 }}>I have read and accept the terms and conditions of this place.</Text>
      </Pressable>
      <Button title="Apply" onPress={apply} busy={busy} />
    </View>
  );
}

export function ReplyForm({ inquiryId, onSent }: { inquiryId: string; onSent: () => void }) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const res = await api(`/inquiries/${inquiryId}/reply`, { reply });
    setBusy(false);
    if (!res.ok) return setError(res.data.error);
    onSent();
  }
  return (
    <View style={{ gap: 8 }}>
      <Banner text={error} />
      <Field label="Reply" value={reply} onChangeText={setReply} multiline style={{ minHeight: 60, textAlignVertical: "top" }} />
      <Button title="Send reply" onPress={send} busy={busy} />
    </View>
  );
}
