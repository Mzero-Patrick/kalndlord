import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { formatPeriod, formatRwf, PAYMENT_METHOD_LABEL, type Payment } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { Banner, Body, Card, Section, Title } from "@/components/ui";

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<Payment>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api<{ payment: Payment }>(`/payments/${id}`).then((res) => (res.ok ? setP(res.data.payment) : setError(res.data.error)));
  }, [id]);
  if (error) return <Screen><Banner text={error} /></Screen>;
  if (!p) return <ActivityIndicator style={{ flex: 1 }} />;
  const rows: [string, string][] = [
    ["Receipt number", p.receiptNo ?? "—"],
    ["Date paid", p.paidAt ? new Date(p.paidAt).toLocaleString("en-GB") : "—"],
    ["Paid by", p.tenant.fullName],
    ["For", `${formatPeriod(p.period)} rent`],
    ["Place", p.property.title],
    ["Landlord", p.landlord.fullName],
    ["Method", p.method ? PAYMENT_METHOD_LABEL[p.method] : "—"],
    ["Reference", p.txRef],
  ];
  return (
    <Screen>
      <Title>Rent receipt</Title>
      <Card label="Paid" value={formatRwf(p.amount)} />
      <Section title="Details">
        {rows.map(([k, v]) => (
          <View key={k} style={{ gap: 2 }}>
            <Body muted>{k}</Body>
            <Body bold>{v}</Body>
          </View>
        ))}
      </Section>
    </Screen>
  );
}
