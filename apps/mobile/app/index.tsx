import { Redirect, router } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/session";
import { Screen } from "@/components/Screen";
import { Button, Muted, Title } from "@/components/ui";

export default function Welcome() {
  const { user, loading } = useSession();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  if (user) return <Redirect href="/home" />;
  return (
    <Screen>
      <Title>Kalndlord</Title>
      <Muted>Find homes and workshops, pay rent with MTN MoMo, Airtel Money or card, and report maintenance issues.</Muted>
      <Button title="Find a place" onPress={() => router.push("/listings")} />
      <Button title="Create an account" secondary onPress={() => router.push("/signup")} />
      <Button title="Log in" secondary onPress={() => router.push("/login")} />
    </Screen>
  );
}
