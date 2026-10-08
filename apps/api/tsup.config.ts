import { defineConfig } from "tsup";

// Bundles the shared package (TypeScript source) into the API build. The seed
// is built too so deploys can create the admin account without dev tools.
export default defineConfig({
  entry: { server: "src/server.ts", seed: "prisma/seed.ts" },
  format: ["esm"],
  target: "node22",
  noExternal: ["@kalndlord/shared"],
  clean: true,
});
