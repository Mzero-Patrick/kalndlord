"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import { applyForListing, askQuestion, replyToQuestion, uploadPhotos } from "@/app/listing-actions";
import { FieldError } from "./Field";

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <div className="alert" role="alert">{state.error}</div>;
  if (state.message) return <div className="notice" role="status">{state.message}</div>;
  return null;
}

export function ApplyForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyForListing, {});
  if (state.message) return <Feedback state={state} />;
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <input type="hidden" name="id" value={listingId} />
      <label>
        When would you like to move in? <span className="hint">Optional</span>
        <input type="date" name="moveInDate" />
      </label>
      <label>
        Message to the landlord <span className="hint">Optional. Say a bit about yourself or your business</span>
        <textarea name="message" maxLength={2000} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="acceptTerms" required />
        <span>I have read and accept the terms and conditions of this place.</span>
      </label>
      <FieldError fields={state.fields} name="acceptTerms" />
      <button type="submit" disabled={pending}>{pending ? "Sending…" : "Apply"}</button>
    </form>
  );
}

export function QuestionForm({ propertyId, compact }: { propertyId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(askQuestion, {});
  return (
    <form action={action} className="stack" key={state.message}>
      <Feedback state={state} />
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      <label>
        Subject
        <input name="subject" required maxLength={120} placeholder={compact ? "e.g. Is there parking?" : "e.g. How do I pay rent?"} />
        <FieldError fields={state.fields} name="subject" />
      </label>
      <label>
        Your question
        <textarea name="message" required maxLength={4000} />
        <FieldError fields={state.fields} name="message" />
      </label>
      <button type="submit" className={compact ? "secondary" : ""} disabled={pending}>{pending ? "Sending…" : "Send question"}</button>
    </form>
  );
}

export function ReplyForm({ inquiryId }: { inquiryId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(replyToQuestion, {});
  if (state.message) return <Feedback state={state} />;
  return (
    <form action={action} className="stack">
      <Feedback state={state} />
      <input type="hidden" name="id" value={inquiryId} />
      <textarea name="reply" required maxLength={4000} placeholder="Write your reply" style={{ minHeight: 70 }} />
      <div><button type="submit" className="small" disabled={pending}>{pending ? "Sending…" : "Reply"}</button></div>
    </form>
  );
}

export function PhotoUploadForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadPhotos, {});
  return (
    <form action={action} className="stack" key={state.message}>
      <Feedback state={state} />
      <input type="hidden" name="id" value={listingId} />
      <label>
        Add photos <span className="hint">JPG, PNG or WebP, up to 5 MB each, 8 per listing</span>
        <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required />
      </label>
      <div><button type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button></div>
    </form>
  );
}
