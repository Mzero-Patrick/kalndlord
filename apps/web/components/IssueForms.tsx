"use client";

import { useActionState, useState } from "react";
import { shrinkPhotos } from "./shrinkPhotos";
import { ISSUE_STATUS_LABEL, MAX_ISSUE_PHOTOS, type IssueStatus } from "@kalndlord/shared";
import type { FormState } from "@/app/actions";
import { reportIssue, updateIssue } from "@/app/issue-actions";
import { FieldError } from "./Field";

export function ReportIssueForm({ places }: { places: { leaseId: string; title: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reportIssue, {});
  const [shrinking, setShrinking] = useState(false);
  const onPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    setShrinking(true);
    await shrinkPhotos(input);
    setShrinking(false);
  };
  return (
    <form action={action} className="stack" key={state.message}>
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      {state.message && <div className="notice" role="status">{state.message}</div>}
      <div className="form-grid">
        {places.length > 1 && (
          <label>
            Place
            <select name="leaseId" required>
              {places.map((p) => <option key={p.leaseId} value={p.leaseId}>{p.title}</option>)}
            </select>
            <FieldError fields={state.fields} name="leaseId" />
          </label>
        )}
        {places.length === 1 && <input type="hidden" name="leaseId" value={places[0]!.leaseId} />}
        <label>
          What is it about?
          <select name="kind" defaultValue="MAINTENANCE">
            <option value="MAINTENANCE">Repair or maintenance</option>
            <option value="OTHER">Other issue (business, neighbours, security…)</option>
          </select>
          <FieldError fields={state.fields} name="kind" />
        </label>
      </div>
      <label>
        Subject
        <input name="subject" required maxLength={120} placeholder="e.g. Leaking pipe in the kitchen" />
        <FieldError fields={state.fields} name="subject" />
      </label>
      <label>
        Message
        <textarea name="message" required maxLength={2000} placeholder="What happened, where, and since when" />
        <FieldError fields={state.fields} name="message" />
      </label>
      <label>
        Photos <span className="hint">Optional, up to {MAX_ISSUE_PHOTOS} (JPG, PNG or WebP, 5 MB each)</span>
        <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple onChange={onPhotos} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="urgent" />
        <span>This is urgent (for example no water, no power, or a security problem)</span>
      </label>
      <div><button type="submit" disabled={pending || shrinking}>{pending ? "Sending…" : shrinking ? "Preparing photos…" : "Send to landlord"}</button></div>
    </form>
  );
}

// Landlords and the administrator can change the status; tenants can reply,
// and reopen a report that was marked done.
export function IssueUpdateForm({ id, status, canManage }: { id: string; status: IssueStatus; canManage: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateIssue, {});
  const choices: IssueStatus[] = canManage ? ["OPEN", "IN_PROGRESS", "DONE"] : status === "DONE" ? ["DONE", "OPEN"] : [];
  return (
    <form action={action} className="stack" key={state.message}>
      {state.error && <div className="alert" role="alert">{state.error}</div>}
      {state.message && <div className="notice" role="status">{state.message}</div>}
      <input type="hidden" name="id" value={id} />
      {choices.length > 0 && (
        <label>
          Status
          <select name="status" defaultValue={status}>
            {choices.map((s) => (
              <option key={s} value={s}>{!canManage && s === "OPEN" ? "Reopen: still a problem" : ISSUE_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Message {canManage && <span className="hint">The tenant gets it by SMS or email</span>}
        <textarea name="message" maxLength={2000} placeholder={canManage ? "e.g. A plumber will come tomorrow at 9" : "Add details or reply"} />
        <FieldError fields={state.fields} name="message" />
      </label>
      <div><button type="submit" disabled={pending}>{pending ? "Sending…" : "Send update"}</button></div>
    </form>
  );
}
