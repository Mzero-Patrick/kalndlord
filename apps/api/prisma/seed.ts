import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Creates the administrator account from env. Safe to run on every deploy: an
// existing account keeps its password unless ADMIN_RESET_PASSWORD=true.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) before seeding");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const reset = process.env.ADMIN_RESET_PASSWORD === "true";
  const admin = await prisma.user.upsert({
    where: { email },
    update: reset ? { passwordHash, role: "ADMIN" } : { role: "ADMIN" },
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
