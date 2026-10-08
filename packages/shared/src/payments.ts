import { z } from "zod";

export type ChargeStatus = "DUE" | "PAID";
export type PaymentMethod = "MTN" | "AIRTEL" | "CARD" | "CASH" | "OTHER";
export type PaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  MTN: "MTN MoMo",
  AIRTEL: "Airtel Money",
  CARD: "Card",
  CASH: "Cash",
  OTHER: "Other",
};

export interface RentCharge {
  id: string;
  period: string; // "2026-10"
  amount: number;
  dueDate: string;
  status: ChargeStatus;
  overdue: boolean;
  paidAt: string | null;
  lease: { id: string; property: { id: string; title: string }; tenant: { id: string; fullName: string } };
  payment: PaymentSummary | null; // the successful payment, when paid
}

export interface PaymentSummary {
  id: string;
  amount: number;
  method: PaymentMethod | null;
  status: PaymentStatus;
  receiptNo: string | null;
  paidAt: string | null;
}

export interface Payment extends PaymentSummary {
  txRef: string;
  provider: string;
  createdAt: string;
  period: string;
  property: { id: string; title: string };
  tenant: { id: string; fullName: string; phone: string | null; email: string | null };
  landlord: { id: string; fullName: string };
  recordedBy: { id: string; fullName: string } | null;
}

export interface Notice {
  id: string;
  subject: string;
  message: string;
  createdAt: string;
  sender: { id: string; fullName: string; role: string };
  recipient: { id: string; fullName: string };
}

export const payChargeSchema = z.object({
  // Where the payment page sends the tenant back to (web page or app link).
  redirectUrl: z.string().url().max(500),
});

export const verifyPaymentSchema = z.object({ txRef: z.string().min(1).max(100) });

export const cashPaymentSchema = z.object({
  note: z.string().trim().max(200).optional(),
});

export const noticeSchema = z.object({
  // A tenant's id, or "ALL" for every tenant of the sender (every tenant, for the administrator).
  to: z.string().min(1),
  subject: z.string().trim().min(3, "Add a short subject").max(120),
  message: z.string().trim().min(5, "Write the message").max(2000),
});

export const formatPeriod = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};
