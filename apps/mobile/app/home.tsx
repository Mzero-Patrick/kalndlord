import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { ActivityIndicator } from "react-native";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { Banner, Button, Card, Muted, Title } from "@/components/ui";

type Summary = Record<string, unknown> & { users?: Record<string, number> };

// One home screen that shows the dashboard for the signed-in role.
export default function Home() {
  const { user, loading, signOut } = useSession();
  const [data, setData] = useState<Summary>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!user) return;
    api<Summary>(`/dashboard/${user.role.toLowerCase()}`).then((res) => {
      if (res.ok) setData(res.data);
      else setError(res.data.error);
    });
  }, [user]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!user) return <Redirect href="/" />;

  async function logout() {
    await signOut();
    router.replace("/");
  }

  return (
    <Screen>
      <Title>{user.role === "ADMIN" ? "Administrator" : `Welcome, ${user.fullName}`}</Title>
      <Muted>{user.role === "LANDLORD" ? "Landlord account" : user.role === "TENANT" ? "Tenant account" : "Administrator account"}</Muted>
      <Banner text={error} />
      {!data && !error ? <ActivityIndicator /> : null}
      {data && user.role === "ADMIN" ? (
        <>
          <Card label="Landlords" value={data.users?.LANDLORD ?? 0} />
          <Card label="Tenants" value={data.users?.TENANT ?? 0} />
        </>
      ) : null}
      {data && user.role === "LANDLORD" ? (
        <>
          <Card label="My listings" value={Number(data.listings ?? 0)} hint="Add houses and workshops in step 2" />
          <Card label="Tenants" value={Number(data.tenants ?? 0)} />
          <Card label="Open maintenance requests" value={Number(data.openRequests ?? 0)} />
        </>
      ) : null}
      {data && user.role === "TENANT" ? (
        <>
          <Card label="My rentals" value={Number(data.leases ?? 0)} hint="Browse spaces in step 2" />
          <Card label="Next payment" value="None" />
          <Card label="My reports" value={Number(data.openRequests ?? 0)} />
        </>
      ) : null}
      <Button title="Log out" secondary onPress={logout} />
    </Screen>
  );
}
