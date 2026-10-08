import type { User } from "@prisma/client";
import type { PublicUser } from "@kalndlord/shared";

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    phoneVerified: !!user.phoneVerifiedAt,
    emailVerified: !!user.emailVerifiedAt,
    createdAt: user.createdAt.toISOString(),
  };
}

export const isVerified = (user: User) => !!user.phoneVerifiedAt || !!user.emailVerifiedAt;
