import "server-only";
import type { Application, Inquiry, Issue, Lease, Listing, Notice, Payment, RentCharge } from "@kalndlord/shared";
import { api } from "./api";

async function items<T>(path: string): Promise<T[]> {
  const res = await api<{ items: T[] }>(path);
  return res.ok ? res.data.items : [];
}

export const myListings = () => items<Listing & { pendingApplications: number }>("/listings/mine");
export const applications = () => items<Application>("/applications");
export const leases = () => items<Lease>("/leases");
export const questions = () => items<Inquiry & { canReply: boolean }>("/inquiries");
export const charges = () => items<RentCharge>("/charges");
export const payments = () => items<Payment>("/payments");
export const notices = () => items<Notice>("/notices");
export const issues = () => items<Issue>("/issues");
