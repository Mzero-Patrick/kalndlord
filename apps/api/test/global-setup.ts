import { execSync } from "node:child_process";

// Tests run against a separate database. Migrations are applied here and
// each test file clears the tables it uses.
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://kalndlord:kalndlord@localhost:5432/kalndlord_test";
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
