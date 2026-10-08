import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Creates (or updates the password of) the administrator account from env.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) before seeding");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN" },
    create: {
      email,
      passwordHash,
      fullName: process.env.ADMIN_NAME ?? "Administrator",
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Admin ready: ${admin.email}`);
}

main().finally(() => prisma.$disconnect());
