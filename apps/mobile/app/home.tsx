import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useFocusEffect } from "expo-router";
import { formatRwf, type Application, type Inquiry, type Lease, type Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ReplyForm } from "@/components/Forms";
import { Banner, Body, Button, Card, Muted, Section, StatusText, Title, usePalette } from "@/components/ui";

type Summary = Record<string, unknown> & { users?: Record<string, number> };
interface Data {
  summary: Summary;
  applications: Application[];
  leases: Lease[];
  questions: (Inquiry & { canReply?: boolean })[];
  listings: (Listing & { pendingApplications: number })[];
}

const items = async <T,>(path: string) => {
  const res = await api<{ items: T[] }>(path);
  return res.ok ? res.data.items : [];
};

// One home screen that shows the dashboard for the signed-in role.
export default function Home() {
  const c = usePalette();
  const { user, loading, signOut } = useSession();
  const [data, setData] = useState<Data>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const manager = user.role !== "TENANT";
    const [summary, applications, leases, questions, listings] = await Promise.all([
      api<Summary>(`/dashboard/${user.role.toLowerCase()}`),
      items<Application>("/applications"),
      items<Lease>("/leases"),
      items<Inquiry & { canReply?: boolean }>("/inquiries"),
      manager ? items<Listing & { pendingApplications: number }>("/listings/mine") : Promise.resolve([]),
    ]);
    if (!summary.ok) return setError(summary.data.error);
    setError(undefined);
    setData({ summary: summary.data, applications, leases, questions, listings });
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!user) return <Redirect href="/" />;

  async function decide(id: string, decision: "accept" | "reject" | "withdraw") {
    const res = await api(`/applications/${id}/${decision}`, {});
    if (!res.ok) setError(res.data.error);
    load();
  }

  async function logout() {
    await signOut();
    router.replace("/");
  }

  const s = data?.summary;
  const tenant = user.role === "TENANT";
  const pending = data?.applications.filter((a) => a.status === "PENDING") ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Title>{user.role === "ADMIN" ? "Administrator" : `Welcome, ${user.fullName}`}</Title>
        <Banner text={error} />
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <View style={{ flex: 1 }}><Button title="Find a place" secondary={!tenant} onPress={() => router.push("/listings")} /></View>
          {!tenant && <View style={{ flex: 1 }}><Button title="List a place" onPress={() => router.push("/listings/new")} /></View>}
        </View>
        {!data ? <ActivityIndicator /> : (
          <>
            {user.role === "ADMIN" && (
              <View style={{ gap: 10 }}>
                <Card label="Landlords" value={s?.users?.LANDLORD ?? 0} />
                <Card label="Tenants" value={s?.users?.TENANT ?? 0} />
                <Card label="Listings" value={Number(s?.listings ?? 0)} />
              </View>
            )}

            {tenant ? (
              <>
                <Section title="My rentals">
                  {data.leases.length === 0 && <Muted>No rentals yet.</Muted>}
                  {data.leases.map((l) => (
                    <View key={l.id} style={{ gap: 2 }}>
                      <Body bold>{l.property.title}</Body>
                      <Body muted>{formatRwf(l.monthlyRent)} / month · {l.property.sector}, {l.property.district}</Body>
                      <Body muted>Landlord: {l.landlord.fullName} {l.landlord.phone ?? l.landlord.email ?? ""}</Body>
                    </View>
                  ))}
                </Section>
                <Section title="My applications">
                  {data.applications.length === 0 && <Muted>You haven't applied anywhere yet.</Muted>}
                  {data.applications.map((a) => (
                    <View key={a.id} style={{ gap: 4 }}>
                      <Body bold>{a.property.title}</Body>
                      <Text><StatusText status={a.status} /></Text>
                      {a.status === "PENDING" && <Button title="Withdraw" secondary onPress={() => decide(a.id, "withdraw")} />}
                    </View>
                  ))}
                </Section>
              </>
            ) : (
              <>
                <Section title={`Applications waiting (${pending.length})`}>
                  {pending.length === 0 && <Muted>No applications waiting.</Muted>}
                  {pending.map((a) => (
                    <View key={a.id} style={{ gap: 6 }}>
                      <Body bold>{a.tenant.fullName} → {a.property.title}</Body>
                      <Body muted>{[a.tenant.phone, a.tenant.email].filter(Boolean).join(" · ")} · accepted the terms</Body>
                      {a.message ? <Body>"{a.message}"</Body> : null}
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1 }}><Button title="Accept" onPress={() => decide(a.id, "accept")} /></View>
                        <View style={{ flex: 1 }}><Button title="Decline" secondary onPress={() => decide(a.id, "reject")} /></View>
                      </View>
                    </View>
                  ))}
                </Section>
                <Section title="Listings">
                  {data.listings.length === 0 && <Muted>No listings yet.</Muted>}
                  {data.listings.map((l) => (
                    <View key={l.id} style={{ gap: 2 }}>
                      <Text style={{ color: c.brand, fontWeight: "600" }} onPress={() => router.push(`/listings/edit/${l.id}`)}>{l.title}</Text>
                      <Body muted>{formatRwf(l.monthlyRent)} · <StatusText status={l.status} /></Body>
                    </View>
                  ))}
                </Section>
                <Section title="Tenants">
                  {data.leases.length === 0 && <Muted>No tenants yet.</Muted>}
                  {data.leases.map((l) => <Body key={l.id}>{l.tenant.fullName} · {l.property.title}</Body>)}
                </Section>
              </>
            )}

            <Section title="Questions">
              {data.questions.length === 0 && <Muted>No questions yet.</Muted>}
              {data.questions.map((q) => (
                <View key={q.id} style={{ gap: 4 }}>
                  <Body bold>{q.subject}</Body>
                  <Body muted>{q.from.fullName} · {q.property?.title ?? "General question"}</Body>
                  <Body>{q.message}</Body>
                  {q.reply ? <Body>Reply: {q.reply}</Body> : !q.canReply ? <Muted>Waiting for a reply</Muted> : null}
                  {q.canReply && <ReplyForm inquiryId={q.id} onSent={load} />}
                </View>
              ))}
              <Button title="Contact us" secondary onPress={() => router.push("/contact")} />
            </Section>
          </>
        )}
        <Button title="Log out" secondary onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}
