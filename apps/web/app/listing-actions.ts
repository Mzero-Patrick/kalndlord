"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Listing } from "@kalndlord/shared";
import { api } from "@/lib/api";
import type { FormState } from "./actions";

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

function listingBody(form: FormData) {
  return {
    title: text(form, "title"),
    type: text(form, "type"),
    description: text(form, "description"),
    district: text(form, "district"),
    sector: text(form, "sector"),
    address: text(form, "address"),
    monthlyRent: text(form, "monthlyRent"),
    deposit: text(form, "deposit"),
    sizeSqm: text(form, "sizeSqm"),
    bedrooms: text(form, "bedrooms"),
    terms: text(form, "terms"),
  };
}

export async function createListing(_: FormState, form: FormData): Promise<FormState> {
  const res = await api<{ listing: Listing }>("/listings", {
    body: { ...listingBody(form), landlordId: text(form, "landlordId") },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  // Photos are added on the edit page, right after creating.
  redirect(`/dashboard/listings/${res.data.listing.id}?created=1`);
}

export async function updateListing(_: FormState, form: FormData): Promise<FormState> {
  const id = text(form, "id")!;
  const res = await api<{ listing: Listing }>(`/listings/${id}`, {
    method: "PATCH",
    body: { ...listingBody(form), status: text(form, "status") },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  revalidatePath("/", "layout");
  return { message: "Saved" };
}

export async function uploadPhotos(_: FormState, form: FormData): Promise<FormState> {
  const id = text(form, "id")!;
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one photo" };
  const body = new FormData();
  for (const f of files) body.append("photos", f, f.name);
  const res = await api(`/listings/${id}/photos`, { body });
  if (!res.ok) return { error: res.data.error };
  revalidatePath(`/dashboard/listings/${id}`);
  return { message: `${files.length} photo${files.length > 1 ? "s" : ""} added` };
}

export async function deletePhoto(form: FormData) {
  const id = text(form, "id")!;
  await api(`/listings/${id}/photos/${text(form, "photoId")}`, { method: "DELETE" });
  revalidatePath(`/dashboard/listings/${id}`);
}

export async function applyForListing(_: FormState, form: FormData): Promise<FormState> {
  const id = text(form, "id")!;
  const res = await api(`/listings/${id}/applications`, {
    body: {
      acceptTerms: form.get("acceptTerms") === "on",
      message: text(form, "message"),
      moveInDate: text(form, "moveInDate"),
    },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  revalidatePath(`/listings/${id}`);
  return { message: "Application sent. The landlord will be in touch, and you'll get a message when they decide." };
}

export async function decideApplication(form: FormData) {
  const decision = text(form, "decision");
  if (decision !== "accept" && decision !== "reject" && decision !== "withdraw") return;
  await api(`/applications/${text(form, "id")}/${decision}`, { method: "POST" });
  revalidatePath("/", "layout");
}

export async function askQuestion(_: FormState, form: FormData): Promise<FormState> {
  const res = await api("/inquiries", {
    body: { propertyId: text(form, "propertyId"), subject: text(form, "subject"), message: text(form, "message") },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  revalidatePath("/", "layout");
  return { message: "Question sent. You'll get a message when there's a reply." };
}

export async function replyToQuestion(_: FormState, form: FormData): Promise<FormState> {
  const res = await api(`/inquiries/${text(form, "id")}/reply`, { body: { reply: text(form, "reply") } });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  revalidatePath("/", "layout");
  return { message: "Reply sent" };
}
