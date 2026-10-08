import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { formatRwf, PROPERTY_TYPE_LABEL, PROPERTY_TYPES, type Listing, type PropertyType } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { Banner, Button, Chip, Field, Muted, Title, usePalette } from "@/components/ui";

export default function Listings() {
  const c = usePalette();
  const [q, setQ] = useState("");
  const [type, setType] = useState<PropertyType>();
  const [maxRent, setMaxRent] = useState("");
  const [data, setData] = useState<{ items: Listing[]; total: number }>();
  const [error, setError] = useState<string>();

  const search = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (maxRent) params.set("maxRent", maxRent);
    const res = await api<{ items: Listing[]; total: number }>(`/listings?${params}`);
    if (res.ok) {
      setData(res.data);
      setError(undefined);
    } else setError(res.data.error);
  }, [q, type, maxRent]);

  useEffect(() => {
    search();
    // Re-run when the type filter changes; text filters run on "Search".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <Screen>
      <Title>Find a place</Title>
      <Field label="Search" placeholder="Area, street, keyword" value={q} onChangeText={setQ} onSubmitEditing={search} returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="Any" active={!type} onPress={() => setType(undefined)} />
        {PROPERTY_TYPES.map((t) => <Chip key={t} label={PROPERTY_TYPE_LABEL[t]} active={type === t} onPress={() => setType(t)} />)}
      </ScrollView>
      <Field label="Max rent (RWF)" value={maxRent} onChangeText={setMaxRent} keyboardType="number-pad" />
      <Button title="Search" onPress={search} />
      <Banner text={error} />
      {data && <Muted>{data.total} place{data.total === 1 ? "" : "s"} available</Muted>}
      {data?.items.map((l) => (
        <Pressable key={l.id} onPress={() => router.push(`/listings/${l.id}`)}
          style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: "hidden", backgroundColor: c.surface }}>
          {l.photos[0] ? (
            <Image source={{ uri: l.photos[0].url }} style={{ width: "100%", aspectRatio: 4 / 3 }} />
          ) : (
            <View style={{ width: "100%", aspectRatio: 4 / 3, backgroundColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: c.muted }}>No photo yet</Text>
            </View>
          )}
          <View style={{ padding: 12, gap: 2 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>{PROPERTY_TYPE_LABEL[l.type]} · {l.sector}, {l.district}</Text>
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>{l.title}</Text>
            <Text style={{ color: c.text, fontWeight: "700" }}>{formatRwf(l.monthlyRent)} / month</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
