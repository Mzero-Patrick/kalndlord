import type { Application, Inquiry, Lease, Photo, Property, User } from "@prisma/client";
import type {
  Application as ApplicationDto,
  Inquiry as InquiryDto,
  Lease as LeaseDto,
  Listing,
} from "@kalndlord/shared";
import type { Storage } from "./storage";

type Contact = Pick<User, "id" | "fullName" | "phone" | "email">;

export function toListing(
  p: Property & { photos: Photo[]; landlord: Pick<User, "id" | "fullName"> },
  storage: Storage,
): Listing {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    description: p.description,
    district: p.district,
    sector: p.sector,
    address: p.address,
    monthlyRent: p.monthlyRent,
    deposit: p.deposit,
    sizeSqm: p.sizeSqm,
    bedrooms: p.bedrooms,
    terms: p.terms,
    status: p.status,
    photos: [...p.photos].sort((a, b) => a.position - b.position).map((ph) => ({ id: ph.id, url: storage.url(ph.key) })),
    landlord: { id: p.landlord.id, fullName: p.landlord.fullName },
    createdAt: p.createdAt.toISOString(),
  };
}

export function toApplication(
  a: Application & { property: Pick<Property, "id" | "title" | "monthlyRent">; tenant: Contact },
): ApplicationDto {
  return {
    id: a.id,
    status: a.status,
    message: a.message,
    moveInDate: a.moveInDate?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    property: { id: a.property.id, title: a.property.title, monthlyRent: a.property.monthlyRent },
    tenant: { id: a.tenant.id, fullName: a.tenant.fullName, phone: a.tenant.phone, email: a.tenant.email },
  };
}

export function toLease(
  l: Lease & {
    property: Pick<Property, "id" | "title" | "district" | "sector">;
    tenant: Pick<User, "id" | "fullName">;
    landlord: Contact;
  },
): LeaseDto {
  return {
    id: l.id,
    status: l.status,
    monthlyRent: l.monthlyRent,
    startDate: l.startDate.toISOString(),
    property: { id: l.property.id, title: l.property.title, district: l.property.district, sector: l.property.sector },
    tenant: { id: l.tenant.id, fullName: l.tenant.fullName },
    landlord: { id: l.landlord.id, fullName: l.landlord.fullName, phone: l.landlord.phone, email: l.landlord.email },
  };
}

export function toInquiry(i: Inquiry & { property: Pick<Property, "id" | "title"> | null; from: Contact }): InquiryDto {
  return {
    id: i.id,
    subject: i.subject,
    message: i.message,
    reply: i.reply,
    repliedAt: i.repliedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    property: i.property ? { id: i.property.id, title: i.property.title } : null,
    from: { id: i.from.id, fullName: i.from.fullName, phone: i.from.phone, email: i.from.email },
  };
}

export const contactSelect = { id: true, fullName: true, phone: true, email: true } as const;
