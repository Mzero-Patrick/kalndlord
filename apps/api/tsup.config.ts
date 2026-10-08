import { defineConfig } from "tsup";

// Bundles the shared package (TypeScript source) into the API build. The seed
// is built too so deploys can create the admin account without dev tools, and
// vercel.js is the entry Vercel runs (see api/index.js).
export default defineConfig({
  entry: { server: "src/server.ts", seed: "prisma/seed.ts", vercel: "src/vercel.ts" },
  format: ["esm"],
  target: "node22",
  noExternal: ["@kalndlord/shared"],
  clean: true,
});
