import { useState } from "react";
import { ScrollView, View } from "react-native";
import { PROPERTY_STATUSES, PROPERTY_TYPE_LABEL, PROPERTY_TYPES, RWANDA_DISTRICTS, type Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import { Banner, Button, Chip, Field, Muted } from "./ui";

type Form = Record<"title" | "description" | "sector" | "address" | "monthlyRent" | "deposit" | "sizeSqm" | "bedrooms" | "terms", string>;

const str = (v: number | string | null | undefined) => (v == null ? "" : String(v));

export function ListingEditor({ listing, onSaved }: { listing?: Listing; onSaved: (l: Listing) => void }) {
  const [form, setForm] = useState<Form>({
    title: str(listing?.title), description: str(listing?.description), sector: str(listing?.sector),
    address: str(listing?.address), monthlyRent: str(listing?.monthlyRent), deposit: str(listing?.deposit),
    sizeSqm: str(listing?.sizeSqm), bedrooms: str(listing?.bedrooms), terms: str(listing?.terms),
  });
  const [type, setType] = useState(listing?.type ?? "HOUSE");
  const [district, setDistrict] = useState(listing?.district ?? "");
  const [status, setStatus] = useState(listing?.status ?? "AVAILABLE");
  const [state, setState] = useState<{ error?: string; ok?: string; fields?: Record<string, string> }>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const f = state.fields;

  async function save() {
    setBusy(true);
    const body: Record<string, unknown> = { type, district, ...(listing ? { status } : {}) };
    for (const [k, v] of Object.entries(form)) if (v.trim()) body[k] = v.trim();
    const res = listing
      ? await api<{ listing: Listing }>(`/listings/${listing.id}`, body, "PATCH")
      : await api<{ listing: Listing }>("/listings", body);
    setBusy(false);
    if (!res.ok) return setState({ error: res.data.error, fields: res.data.fields });
    setState({ ok: "Saved" });
    onSaved(res.data.listing);
  }

  return (
    <View style={{ gap: 12 }}>
      <Banner text={state.error} />
      <Banner text={state.ok} kind="ok" />
      <Field label="Title" value={form.title} onChangeText={set("title")} error={f?.title} />
      <Muted>Type</Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PROPERTY_TYPES.map((t) => <Chip key={t} label={PROPERTY_TYPE_LABEL[t]} active={type === t} onPress={() => setType(t)} />)}
      </ScrollView>
      <Muted>District{f?.district ? ` (${f.district})` : ""}</Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {RWANDA_DISTRICTS.map((d) => <Chip key={d} label={d} active={district === d} onPress={() => setDistrict(d)} />)}
      </ScrollView>
      <Field label="Sector" value={form.sector} onChangeText={set("sector")} error={f?.sector} />
      <Field label="Address or directions (optional)" value={form.address} onChangeText={set("address")} />
      <Field label="Description" value={form.description} onChangeText={set("description")} error={f?.description}
        multiline style={{ minHeight: 90, textAlignVertical: "top" }} />
      <Field label="Monthly rent (RWF)" value={form.monthlyRent} onChangeText={set("monthlyRent")} keyboardType="number-pad" error={f?.monthlyRent} />
      <Field label="Deposit (RWF, optional)" value={form.deposit} onChangeText={set("deposit")} keyboardType="number-pad" />
      <Field label="Size in m² (optional)" value={form.sizeSqm} onChangeText={set("sizeSqm")} keyboardType="number-pad" />
      <Field label="Bedrooms (optional)" value={form.bedrooms} onChangeText={set("bedrooms")} keyboardType="number-pad" />
      <Field label="Terms and conditions" hint="Tenants must read and accept these before applying" value={form.terms}
        onChangeText={set("terms")} error={f?.terms} multiline style={{ minHeight: 140, textAlignVertical: "top" }} />
      {listing && (
        <>
          <Muted>Status</Muted>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {PROPERTY_STATUSES.map((s) => (
              <Chip key={s} label={s.charAt(0) + s.slice(1).toLowerCase()} active={status === s} onPress={() => setStatus(s)} />
            ))}
          </View>
        </>
      )}
      <Button title={listing ? "Save changes" : "Create listing"} onPress={save} busy={busy} />
    </View>
  );
}
