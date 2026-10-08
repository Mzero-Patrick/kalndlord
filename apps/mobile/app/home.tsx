import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useFocusEffect } from "expo-router";
import {
  formatPeriod,
  formatRwf,
  ISSUE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  type Application,
  type Inquiry,
  type Issue,
  type Lease,
  type Listing,
  type Notice,
  type RentCharge,
} from "@kalndlord/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { NoticeForm, ReplyForm } from "@/components/Forms";
import { payCharge } from "@/lib/pay";
import { Banner, Body, Button, Card, Muted, Section, StatusText, Title, usePalette } from "@/components/ui";

type Summary = Record<string, unknown> & { users?: Record<string, number> };
interface Data {
  summary: Summary;
  applications: Application[];
  leases: Lease[];
  questions: (Inquiry & { canReply?: boolean })[];
  listings: (Listing & { pendingApplications: number })[];
  charges: RentCharge[];
  notices: Notice[];
  issues: Issue[];
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
  const [paying, setPaying] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    if (!user) return;
    const manager = user.role !== "TENANT";
    const [summary, applications, leases, questions, listings, charges, notices, issues] = await Promise.all([
      api<Summary>(`/dashboard/${user.role.toLowerCase()}`),
      items<Application>("/applications"),
      items<Lease>("/leases"),
      items<Inquiry & { canReply?: boolean }>("/inquiries"),
      manager ? items<Listing & { pendingApplications: number }>("/listings/mine") : Promise.resolve([]),
      items<RentCharge>("/charges"),
      items<Notice>("/notices"),
      items<Issue>("/issues"),
    ]);
    if (!summary.ok) return setError(summary.data.error);
    setError(undefined);
    setData({ summary: summary.data, applications, leases, questions, listings, charges, notices, issues });
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!user) return <Redirect href="/" />;

  async function decide(id: string, decision: "accept" | "reject" | "withdraw") {
    const res = await api(`/applications/${id}/${decision}`, {});
    if (!res.ok) setError(res.data.error);
    load();
  }

  async function pay(chargeId: string) {
    setPaying(chargeId);
    const res = await payCharge(chargeId);
    setPaying(undefined);
    if (res.error) setError(res.error);
    else if (res.payment?.status === "SUCCESSFUL") {
      setError(undefined);
      setNotice(`Payment received: ${formatRwf(res.payment.amount)}. Receipt ${res.payment.receiptNo}.`);
    } else if (res.payment?.status === "FAILED") setError("The payment didn't go through. Nothing was taken.");
    else setNotice("Waiting for the payment to be confirmed. Pull down to refresh in a minute.");
    load();
  }

  async function recordCash(chargeId: string) {
    const res = await api(`/charges/${chargeId}/cash`, {});
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
        <Banner text={notice} kind="ok" />
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


            <Section title={`Repairs and other issues (${Number(s?.openRequests ?? 0)} open)`}>
              {data.issues.length === 0 && <Muted>{tenant ? "Nothing reported. Tell your landlord about repairs or any other issue." : "No reports from tenants yet."}</Muted>}
              {[...data.issues].sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE")).slice(0, 10).map((i) => (
                <View key={i.id} style={{ gap: 2 }}>
                  <Text style={{ color: c.brand, fontWeight: "600" }} onPress={() => router.push(`/issues/${i.id}`)}>{i.subject}</Text>
                  <Body muted>
                    {i.urgent && i.status !== "DONE" ? "Urgent · " : ""}{ISSUE_STATUS_LABEL[i.status]} · {i.property.title}{tenant ? "" : ` · ${i.tenant.fullName}`}
                  </Body>
                </View>
              ))}
              {tenant && data.leases.some((l) => l.status === "ACTIVE") && (
                <Button title="Report a problem" onPress={() => router.push("/issues/new")} />
              )}
            </Section>

            <Section title="Rent">
              {data.charges.length === 0 && <Muted>No rent bills yet.</Muted>}
              {[...data.charges].sort((a, b) => (a.status === b.status ? 0 : a.status === "DUE" ? -1 : 1)).map((ch) => (
                <View key={ch.id} style={{ gap: 4 }}>
                  <Body bold>{formatPeriod(ch.period)} · {formatRwf(ch.amount)}</Body>
                  <Body muted>{ch.lease.property.title}{tenant ? "" : ` · ${ch.lease.tenant.fullName}`}</Body>
                  {ch.status === "PAID" ? (
                    <Text style={{ color: c.ok }} onPress={() => ch.payment && router.push(`/receipts/${ch.payment.id}`)}>
                      Paid{ch.payment?.method ? ` with ${PAYMENT_METHOD_LABEL[ch.payment.method]}` : ""} · View receipt
                    </Text>
                  ) : (
                    <>
                      <Text style={{ color: ch.overdue ? c.danger : "#b54708" }}>
                        {ch.overdue ? "Overdue" : "Due"} {new Date(ch.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </Text>
                      {tenant ? (
                        <Button title="Pay with MoMo, Airtel or card" onPress={() => pay(ch.id)} busy={paying === ch.id} />
                      ) : (
                        <Button title="Record cash payment" secondary onPress={() => recordCash(ch.id)} />
                      )}
                    </>
                  )}
                </View>
              ))}
            </Section>

            {tenant ? (
              <>
                {data.notices.length > 0 && (
                  <Section title="Notices">
                    {data.notices.slice(0, 5).map((n) => (
                      <View key={n.id} style={{ gap: 2 }}>
                        <Body bold>{n.subject}</Body>
                        <Body muted>From {n.sender.fullName}</Body>
                        <Body>{n.message}</Body>
                      </View>
                    ))}
                  </Section>
                )}
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
                {(data.leases.length > 0 || user.role === "ADMIN") && (
                  <Section title="Send a notice">
                    <NoticeForm label={user.role === "ADMIN" ? "Send to every tenant" : "Send to all my tenants"} />
                  </Section>
                )}
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
