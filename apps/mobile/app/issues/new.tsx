import { useEffect, useState } from "react";
import { Image, Pressable, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { MAX_ISSUE_PHOTOS, type Issue, type IssueKind, type Lease } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { photoFiles } from "@/lib/photos";
import { Screen } from "@/components/Screen";
import { Banner, Button, Chip, Field, Muted, Title, usePalette } from "@/components/ui";

// A tenant reports a repair or any other issue to their landlord, with photos.
export default function ReportIssue() {
  const c = usePalette();
  const [places, setPlaces] = useState<Lease[]>();
  const [leaseId, setLeaseId] = useState<string>();
  const [kind, setKind] = useState<IssueKind>("MAINTENANCE");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [state, setState] = useState<{ error?: string; fields?: Record<string, string> }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Lease[] }>("/leases").then((res) => {
      const active = res.ok ? res.data.items.filter((l) => l.status === "ACTIVE") : [];
      setPlaces(active);
      setLeaseId(active[0]?.id);
    });
  }, []);

  async function pick() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ISSUE_PHOTOS - photos.length,
      quality: 0.7,
    });
    if (!picked.canceled) setPhotos([...photos, ...picked.assets].slice(0, MAX_ISSUE_PHOTOS));
  }

  async function send() {
    const body = new FormData();
    if (leaseId) body.append("leaseId", leaseId);
    body.append("kind", kind);
    body.append("urgent", urgent ? "true" : "false");
    body.append("subject", subject);
    body.append("message", message);
    setBusy(true);
    // React Native's FormData takes a { uri, name, type } descriptor for files.
    for (const f of await photoFiles(photos)) body.append("photos", f as unknown as Blob);
    const res = await api<{ issue: Issue }>("/issues", body);
    setBusy(false);
    if (!res.ok) return setState({ error: res.data.error, fields: res.data.fields });
    router.replace(`/issues/${res.data.issue.id}`);
  }

  if (places && !places.length)
    return <Screen><Title>Report a problem</Title><Muted>Once you rent a place, you can report repairs and other issues to your landlord here.</Muted></Screen>;

  return (
    <Screen>
      <Title>Report a problem</Title>
      <Muted>Your landlord gets an SMS or email, and you'll hear back the same way.</Muted>
      <Banner text={state.error} />
      {places && places.length > 1 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {places.map((p) => <Chip key={p.id} label={p.property.title} active={leaseId === p.id} onPress={() => setLeaseId(p.id)} />)}
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip label="Repair or maintenance" active={kind === "MAINTENANCE"} onPress={() => setKind("MAINTENANCE")} />
        <Chip label="Other issue" active={kind === "OTHER"} onPress={() => setKind("OTHER")} />
      </View>
      <Field label="Subject" value={subject} onChangeText={setSubject} error={state.fields?.subject}
        placeholder="e.g. Leaking pipe in the kitchen" />
      <Field label="Message" value={message} onChangeText={setMessage} multiline numberOfLines={5}
        style={{ minHeight: 110, textAlignVertical: "top" }} error={state.fields?.message}
        placeholder="What happened, where, and since when" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {photos.map((p, i) => (
          <Pressable key={p.uri} onPress={() => setPhotos(photos.filter((_, j) => j !== i))}>
            <Image source={{ uri: p.uri }} style={{ width: 90, height: 90, borderRadius: 8 }} />
            <Text style={{ color: c.danger, textAlign: "center" }}>Remove</Text>
          </Pressable>
        ))}
      </View>
      {photos.length < MAX_ISSUE_PHOTOS && <Button title={`Add photos (up to ${MAX_ISSUE_PHOTOS})`} secondary onPress={pick} />}
      <Pressable onPress={() => setUrgent(!urgent)} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Switch value={urgent} onValueChange={setUrgent} />
        <Text style={{ color: c.text, flex: 1 }}>This is urgent (no water, no power, or a security problem)</Text>
      </Pressable>
      <Button title="Send to landlord" onPress={send} busy={busy || !places} />
    </Screen>
  );
}
