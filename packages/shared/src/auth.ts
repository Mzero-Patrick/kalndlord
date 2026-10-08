import { z } from "zod";
import { normalizeRwandaPhone } from "./phone";

export const ROLES = ["ADMIN", "LANDLORD", "TENANT"] as const;
export type Role = (typeof ROLES)[number];

// Only landlords and tenants can sign up themselves; admins are created by the seed.
export const SELF_SIGNUP_ROLES = ["LANDLORD", "TENANT"] as const;

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizeRwandaPhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid MTN or Airtel Rwanda number" });
      return z.NEVER;
    }
    return normalized;
  });

const email = z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email" }));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    phone: phone.optional(),
    email: email.optional(),
    password: passwordSchema,
    role: z.enum(SELF_SIGNUP_ROLES),
    // Where the verification code is sent. Defaults to phone when given.
    verifyVia: z.enum(["PHONE", "EMAIL"]).optional(),
  })
  .refine((v) => v.phone || v.email, {
    message: "Enter a phone number or an email",
    path: ["phone"],
  })
  .transform((v) => ({
    ...v,
    verifyVia: v.verifyVia ?? (v.phone ? "PHONE" : "EMAIL"),
  }))
  .refine((v) => (v.verifyVia === "PHONE" ? !!v.phone : !!v.email), {
    message: "Provide the contact you want the code sent to",
    path: ["verifyVia"],
  });
export type RegisterInput = z.input<typeof registerSchema>;

export const verifySchema = z.object({
  userId: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, "The code has 6 digits"),
});
export type VerifyInput = z.infer<typeof verifySchema>;

export const resendSchema = z.object({ userId: z.string().min(1) });

// Login identifier is a phone number or an email.
export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your phone or email"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Forgotten password: a code goes to the phone or email given, then the
// code and a new password reset it.
export const forgotSchema = z.object({ identifier: z.string().trim().min(3, "Enter your phone or email") });
export const resetSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your phone or email"),
  code: z.string().trim().regex(/^\d{6}$/, "The code has 6 digits"),
  password: passwordSchema,
});

export interface PublicUser {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: Role;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface RegisterResponse {
  userId: string;
  sentTo: string; // masked destination, e.g. "+250 78*** **45"
  channel: "PHONE" | "EMAIL";
}

export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}

// Where each role lands after login.
export const DASHBOARD_PATH: Record<Role, string> = {
  ADMIN: "/dashboard/admin",
  LANDLORD: "/dashboard/landlord",
  TENANT: "/dashboard/tenant",
};
