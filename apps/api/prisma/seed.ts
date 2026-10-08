import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Creates the administrator account from env. Safe to run on every deploy: an
// existing account keeps its password unless ADMIN_RESET_PASSWORD=true.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  // Deploys pass --if-configured so a missing admin setting doesn't stop them.
  if ((!email || !password) && process.argv.includes("--if-configured")) {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping the administrator account");
    return;
  }
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
