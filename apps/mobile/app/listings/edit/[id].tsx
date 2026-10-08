import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import type { Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { ListingEditor } from "@/components/ListingEditor";
import { Banner, Button, Muted, Section, Title, usePalette } from "@/components/ui";

const MAX_PHOTOS = 8;

export default function EditListing() {
  const c = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing>();
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ listing: Listing }>(`/listings/${id}`);
    if (res.ok) setListing(res.data.listing);
    else setError(res.data.error);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function addPhotos() {
    if (!listing) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - listing.photos.length,
      quality: 0.7,
    });
    if (picked.canceled) return;
    const body = new FormData();
    for (const a of picked.assets) {
      const type = a.mimeType ?? "image/jpeg";
      // React Native's FormData takes a { uri, name, type } descriptor for files.
      body.append("photos", { uri: a.uri, name: a.fileName ?? `photo.${type.split("/")[1]}`, type } as unknown as Blob);
    }
    setUploading(true);
    const res = await api<{ listing: Listing }>(`/listings/${listing.id}/photos`, body);
    setUploading(false);
    if (!res.ok) return setError(res.data.error);
    setError(undefined);
    setListing(res.data.listing);
  }

  async function removePhoto(photoId: string) {
    const res = await api(`/listings/${id}/photos/${photoId}`, undefined, "DELETE");
    if (!res.ok) return setError(res.data.error);
    load();
  }

  if (!listing) return error ? <Screen><Banner text={error} /></Screen> : <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <Screen>
      <Title>{listing.title}</Title>
      <Banner text={error} />
      <Section title="Photos">
        {listing.photos.length === 0 && <Muted>No photos yet.</Muted>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {listing.photos.map((p) => (
            <View key={p.id} style={{ width: "48%" }}>
              <Image source={{ uri: p.url }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 8 }} />
              <Pressable onPress={() => removePhoto(p.id)} style={{ paddingVertical: 6 }}>
                <Text style={{ color: c.danger }}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
        {listing.photos.length < MAX_PHOTOS && <Button title="Add photos" onPress={addPhotos} busy={uploading} />}
      </Section>
      <Section title="Details">
        <ListingEditor listing={listing} onSaved={setListing} />
      </Section>
    </Screen>
  );
}
