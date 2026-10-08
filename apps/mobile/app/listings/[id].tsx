import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatRwf, PROPERTY_TYPE_LABEL, type Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Screen } from "@/components/Screen";
import { ApplyForm, QuestionForm } from "@/components/Forms";
import { Banner, Body, Button, Muted, Section, StatusText, Title, usePalette } from "@/components/ui";

interface Detail {
  listing: Listing;
  myApplication: { id: string; status: string } | null;
  canManage: boolean;
}

export default function ListingDetail() {
  const c = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const res = await api<Detail>(`/listings/${id}`);
    if (res.ok) setData(res.data);
    else setError(res.data.error);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <Screen><Banner text={error} /><Button title="Back" secondary onPress={() => router.back()} /></Screen>;
  if (!data) return <ActivityIndicator style={{ flex: 1 }} />;
  const l = data.listing;
  const app = data.myApplication;
  const hasLiveApplication = app && app.status !== "WITHDRAWN" && app.status !== "REJECTED";

  return (
    <Screen>
      <Title>{l.title}</Title>
      <Muted>{l.sector}, {l.district}{l.address ? ` · ${l.address}` : ""} · Listed by {l.landlord.fullName}</Muted>
      {l.photos.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {l.photos.map((p) => (
            <Image key={p.id} source={{ uri: p.url }} style={{ width: 300, aspectRatio: 4 / 3, borderRadius: 8 }} />
          ))}
        </ScrollView>
      )}
      <Section title={`${formatRwf(l.monthlyRent)} / month`}>
        <Body muted>
          {[PROPERTY_TYPE_LABEL[l.type], l.bedrooms != null ? `${l.bedrooms} bedrooms` : null, l.sizeSqm ? `${l.sizeSqm} m²` : null,
            l.deposit ? `Deposit ${formatRwf(l.deposit)}` : null].filter(Boolean).join(" · ")}
        </Body>
        <Body>{l.description}</Body>
      </Section>
      <Section title="Terms and conditions">
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10, backgroundColor: c.bg }}>
          <Text style={{ color: c.text }}>{l.terms}</Text>
        </View>
      </Section>

      {data.canManage ? (
        <Section title="You manage this listing">
          <Button title="Edit listing and photos" onPress={() => router.push(`/listings/edit/${l.id}`)} />
        </Section>
      ) : !user ? (
        <Section title="Interested?">
          <Body muted>Log in or create a tenant account to apply or ask a question.</Body>
          <Button title="Log in" onPress={() => router.push("/login")} />
        </Section>
      ) : (
        <>
          {user.role === "TENANT" && (
            <Section title="Apply">
              {hasLiveApplication ? (
                <Body>Your application: <StatusText status={app.status} /></Body>
              ) : l.status === "AVAILABLE" ? (
                <ApplyForm listingId={l.id} onApplied={load} />
              ) : (
                <Body muted>This place is no longer available.</Body>
              )}
            </Section>
          )}
          <Section title="Ask the landlord">
            <QuestionForm propertyId={l.id} />
          </Section>
        </>
      )}
    </Screen>
  );
}
