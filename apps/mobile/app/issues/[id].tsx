import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ISSUE_KIND_LABEL, ISSUE_STATUS_LABEL, type Issue, type IssueStatus } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Screen } from "@/components/Screen";
import { Banner, Body, Button, Chip, Field, Muted, Section, Title, usePalette } from "@/components/ui";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default function IssueDetail() {
  const c = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [issue, setIssue] = useState<Issue>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<IssueStatus>();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string>();
  const [busy, setBusy] = useState(false);

  const show = useCallback((i: Issue) => {
    setIssue(i);
    setStatus(i.status);
  }, []);
  useEffect(() => {
    api<{ issue: Issue }>(`/issues/${id}`).then((res) => (res.ok ? show(res.data.issue) : setError(res.data.error)));
  }, [id, show]);

  if (error && !issue) return <Screen><Banner text={error} /></Screen>;
  if (!issue || !user) return <ActivityIndicator style={{ flex: 1 }} />;

  const canManage = user.role !== "TENANT";
  const choices: IssueStatus[] = canManage ? ["OPEN", "IN_PROGRESS", "DONE"] : issue.status === "DONE" ? ["DONE", "OPEN"] : [];
  const tone = { OPEN: c.danger, IN_PROGRESS: "#b54708", DONE: c.ok }[issue.status];

  async function send() {
    setBusy(true);
    const res = await api<{ issue: Issue }>(`/issues/${id}/updates`, {
      message: message || undefined,
      status: status !== issue!.status ? status : undefined,
    });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? res.data.fields?.message);
    setError(undefined);
    setMessage("");
    setSent("Update sent");
    show(res.data.issue);
  }

  return (
    <Screen>
      <Title>{issue.subject}</Title>
      <Body bold>{issue.urgent && issue.status !== "DONE" ? "Urgent · " : ""}{ISSUE_STATUS_LABEL[issue.status]}</Body>
      <View style={{ height: 4, backgroundColor: tone, borderRadius: 2 }} />
      <Muted>{ISSUE_KIND_LABEL[issue.kind]} · {issue.property.title} · {issue.tenant.fullName} · {when(issue.createdAt)}</Muted>
      {canManage && <Muted>{[issue.tenant.phone, issue.tenant.email].filter(Boolean).join(" · ")}</Muted>}
      <Body>{issue.message}</Body>
      {issue.photos.map((p) => (
        <Image key={p.id} source={{ uri: p.url }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 8 }} />
      ))}

      <Section title="Updates">
        {issue.updates.length === 0 && <Muted>{canManage ? "No updates yet." : "No updates yet. Your landlord has been told."}</Muted>}
        {issue.updates.map((u) => (
          <View key={u.id} style={{ gap: 2 }}>
            <Body bold>{u.author.fullName}</Body>
            <Muted>{when(u.createdAt)}{u.status ? ` · marked "${ISSUE_STATUS_LABEL[u.status]}"` : ""}</Muted>
            {u.message ? <Body>{u.message}</Body> : null}
          </View>
        ))}
      </Section>

      <Section title={canManage ? "Update the tenant" : "Reply"}>
        <Banner text={error} />
        <Banner text={sent} kind="ok" />
        {choices.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {choices.map((s) => (
              <Chip key={s} label={!canManage && s === "OPEN" ? "Reopen: still a problem" : ISSUE_STATUS_LABEL[s]}
                active={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        )}
        <Field label="Message" value={message} onChangeText={setMessage} multiline
          style={{ minHeight: 80, textAlignVertical: "top" }}
          placeholder={canManage ? "e.g. A plumber will come tomorrow at 9" : "Add details or reply"} />
        <Button title="Send update" onPress={send} busy={busy} />
      </Section>
    </Screen>
  );
}
