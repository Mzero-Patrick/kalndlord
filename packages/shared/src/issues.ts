import { z } from "zod";

export type IssueKind = "MAINTENANCE" | "OTHER";
export type IssueStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export const MAX_ISSUE_PHOTOS = 4;

export const ISSUE_KIND_LABEL: Record<IssueKind, string> = {
  MAINTENANCE: "Repair or maintenance",
  OTHER: "Other issue",
};

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "Being fixed",
  DONE: "Done",
};

export interface IssueUpdate {
  id: string;
  message: string | null;
  status: IssueStatus | null;
  createdAt: string;
  author: { id: string; fullName: string; role: string };
}

export interface Issue {
  id: string;
  kind: IssueKind;
  urgent: boolean;
  subject: string;
  message: string;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  property: { id: string; title: string };
  tenant: { id: string; fullName: string; phone: string | null; email: string | null };
  landlord: { id: string; fullName: string };
  photos: { id: string; url: string }[];
  updates: IssueUpdate[];
}

// Form fields arrive as text (the report is sent with its photos as multipart).
export const issueSchema = z.object({
  leaseId: z.string().min(1).optional(),
  kind: z.enum(["MAINTENANCE", "OTHER"], { message: "Choose what this is about" }),
  urgent: z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean()).default(false),
  subject: z.string().trim().min(3, "Add a short subject").max(120),
  message: z.string().trim().min(5, "Describe the problem").max(2000),
});

export const issueUpdateSchema = z
  .object({
    message: z.string().trim().max(2000).optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
  })
  .refine((v) => v.message || v.status, { message: "Write a message", path: ["message"] });
