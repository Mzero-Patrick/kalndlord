import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { ListingEditor } from "@/components/ListingEditor";
import { Muted, Title } from "@/components/ui";

export default function NewListing() {
  return (
    <Screen>
      <Title>List a place</Title>
      <Muted>After saving you can add photos.</Muted>
      <ListingEditor onSaved={(l) => router.replace(`/listings/edit/${l.id}`)} />
    </Screen>
  );
}
