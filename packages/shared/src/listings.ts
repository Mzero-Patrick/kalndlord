import { z } from "zod";

export const PROPERTY_TYPES = ["HOUSE", "APARTMENT", "ROOM", "WORKSHOP", "OFFICE", "SHOP"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  HOUSE: "House",
  APARTMENT: "Apartment",
  ROOM: "Room",
  WORKSHOP: "Workshop",
  OFFICE: "Office",
  SHOP: "Shop",
};

// AVAILABLE shows in search. OCCUPIED is set when an application is accepted.
// HIDDEN is taken down by the landlord or administrator.
export const PROPERTY_STATUSES = ["AVAILABLE", "OCCUPIED", "HIDDEN"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const RWANDA_DISTRICTS = [
  "Gasabo", "Kicukiro", "Nyarugenge",
  "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana",
  "Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo",
  "Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango",
  "Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro",
] as const;

const rwf = z.coerce.number().int("Use whole francs").min(0, "Can't be negative").max(1_000_000_000);

export const listingSchema = z.object({
  title: z.string().trim().min(3, "Give the place a short title").max(120),
  type: z.enum(PROPERTY_TYPES),
  description: z.string().trim().min(10, "Describe the place in a sentence or two").max(4000),
  district: z.enum(RWANDA_DISTRICTS, { message: "Pick a district" }),
  sector: z.string().trim().min(2, "Enter the sector").max(80),
  address: z.string().trim().max(200).optional(),
  monthlyRent: rwf.refine((v) => v > 0, "Enter the monthly rent"),
  deposit: rwf.optional(),
  sizeSqm: z.coerce.number().int().min(1).max(100_000).optional(),
  bedrooms: z.coerce.number().int().min(0).max(50).optional(),
  terms: z.string().trim().min(10, "Write the terms and conditions tenants must accept").max(10_000),
  // Only an administrator may list on behalf of a landlord.
  landlordId: z.string().optional(),
});
export type ListingInput = z.input<typeof listingSchema>;

export const listingUpdateSchema = listingSchema
  .omit({ landlordId: true })
  .partial()
  .extend({ status: z.enum(PROPERTY_STATUSES).optional() });

export const listingSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(PROPERTY_TYPES).optional(),
  district: z.enum(RWANDA_DISTRICTS).optional(),
  minRent: z.coerce.number().int().min(0).optional(),
  maxRent: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListingSearch = z.input<typeof listingSearchSchema>;

export const applicationSchema = z.object({
  message: z.string().trim().max(2000).optional(),
  acceptTerms: z.literal(true, { message: "You must accept the terms and conditions" }),
  moveInDate: z.coerce.date().optional(),
});

export const inquirySchema = z.object({
  propertyId: z.string().optional(),
  subject: z.string().trim().min(3, "Add a short subject").max(120),
  message: z.string().trim().min(5, "Write your question").max(4000),
});

export const replySchema = z.object({ reply: z.string().trim().min(1, "Write a reply").max(4000) });

export interface Photo {
  id: string;
  url: string;
}

export interface Listing {
  id: string;
  title: string;
  type: PropertyType;
  description: string;
  district: string;
  sector: string;
  address: string | null;
  monthlyRent: number;
  deposit: number | null;
  sizeSqm: number | null;
  bedrooms: number | null;
  terms: string;
  status: PropertyStatus;
  photos: Photo[];
  landlord: { id: string; fullName: string };
  createdAt: string;
}

export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface Application {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  moveInDate: string | null;
  createdAt: string;
  property: { id: string; title: string; monthlyRent: number };
  tenant: { id: string; fullName: string; phone: string | null; email: string | null };
}

export interface Lease {
  id: string;
  status: "ACTIVE" | "ENDED";
  monthlyRent: number;
  startDate: string;
  property: { id: string; title: string; district: string; sector: string };
  tenant: { id: string; fullName: string };
  landlord: { id: string; fullName: string; phone: string | null; email: string | null };
}

export interface Inquiry {
  id: string;
  subject: string;
  message: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  property: { id: string; title: string } | null;
  from: { id: string; fullName: string; phone: string | null; email: string | null };
}

export const formatRwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
