"use client";

import { useActionState } from "react";
import { PROPERTY_STATUSES, PROPERTY_TYPE_LABEL, PROPERTY_TYPES, RWANDA_DISTRICTS, type Listing } from "@kalndlord/shared";
import type { FormState } from "@/app/actions";
import { createListing, updateListing } from "@/app/listing-actions";
import { FieldError } from "./Field";

const STATUS_LABEL = { AVAILABLE: "Available (shown in search)", OCCUPIED: "Occupied", HIDDEN: "Hidden" };

export function ListingForm({ listing, landlords }: { listing?: Listing; landlords?: { id: string; fullName: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(listing ? updateListing : createListing, {});
  const f = state.fields;
  return (
    <form action={action} className="stack">
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      {state.message && <div className="notice" role="status">{state.message}</div>}
      {listing && <input type="hidden" name="id" value={listing.id} />}

      {landlords && (
        <label>
          Landlord <span className="hint">Leave on "Me" to list it under the administrator account</span>
          <select name="landlordId" defaultValue="">
            <option value="">Me</option>
            {landlords.map((l) => <option key={l.id} value={l.id}>{l.fullName}</option>)}
          </select>
          <FieldError fields={f} name="landlordId" />
        </label>
      )}

      <label>
        Title <span className="hint">e.g. "Workshop on KN 5 Rd" or "3-bedroom house in Kicukiro"</span>
        <input name="title" defaultValue={listing?.title} required maxLength={120} />
        <FieldError fields={f} name="title" />
      </label>
      <div className="form-grid">
        <label>
          Type
          <select name="type" defaultValue={listing?.type ?? "HOUSE"}>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label>
          District
          <select name="district" defaultValue={listing?.district ?? ""} required>
            <option value="" disabled>Choose…</option>
            {RWANDA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <FieldError fields={f} name="district" />
        </label>
        <label>
          Sector
          <input name="sector" defaultValue={listing?.sector} required />
          <FieldError fields={f} name="sector" />
        </label>
      </div>
      <label>
        Address or directions <span className="hint">Optional</span>
        <input name="address" defaultValue={listing?.address ?? ""} />
      </label>
      <label>
        Description <span className="hint">A short, simple description of the house or workshop</span>
        <textarea name="description" defaultValue={listing?.description} required />
        <FieldError fields={f} name="description" />
      </label>
      <div className="form-grid">
        <label>
          Monthly rent (RWF)
          <input name="monthlyRent" type="number" min={1} step={1} defaultValue={listing?.monthlyRent} required />
          <FieldError fields={f} name="monthlyRent" />
        </label>
        <label>
          Deposit (RWF) <span className="hint">Optional</span>
          <input name="deposit" type="number" min={0} step={1} defaultValue={listing?.deposit ?? ""} />
        </label>
        <label>
          Size (m²) <span className="hint">Optional</span>
          <input name="sizeSqm" type="number" min={1} defaultValue={listing?.sizeSqm ?? ""} />
        </label>
        <label>
          Bedrooms <span className="hint">Optional</span>
          <input name="bedrooms" type="number" min={0} defaultValue={listing?.bedrooms ?? ""} />
        </label>
      </div>
      <label>
        Terms and conditions <span className="hint">Tenants must read and accept these before applying</span>
        <textarea name="terms" defaultValue={listing?.terms} required style={{ minHeight: 180 }}
          placeholder={"e.g. Rent is paid by the 5th of each month.\nOne month deposit, refunded when you leave.\nNo subletting without permission."} />
        <FieldError fields={f} name="terms" />
      </label>
      {listing && (
        <label>
          Status
          <select name="status" defaultValue={listing.status}>
            {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
      )}
      <div><button type="submit" disabled={pending}>{pending ? "Saving…" : listing ? "Save changes" : "Create listing"}</button></div>
    </form>
  );
}
