"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type { FormState } from "./actions";

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

// Sends a repair or other issue to the landlord, with any photos attached.
export async function reportIssue(_: FormState, form: FormData): Promise<FormState> {
  const body = new FormData();
  for (const key of ["leaseId", "kind", "subject", "message"]) {
    const v = text(form, key);
    if (v) body.append(key, v);
  }
  body.append("urgent", form.get("urgent") === "on" ? "true" : "false");
  for (const f of form.getAll("photos")) if (f instanceof File && f.size > 0) body.append("photos", f, f.name);
  const res = await api("/issues", { body });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  revalidatePath("/", "layout");
  return { message: "Sent to your landlord. You'll get a message when they reply or update it." };
}

export async function updateIssue(_: FormState, form: FormData): Promise<FormState> {
  const res = await api(`/issues/${text(form, "id")}/updates`, {
    body: { message: text(form, "message"), status: text(form, "status") },
  });
  if (!res.ok) return { error: res.data.error, fields: res.data.fields };
  revalidatePath("/", "layout");
  return { message: "Update sent" };
}
