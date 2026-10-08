import { defineConfig } from "tsup";

// Bundles the shared package (TypeScript source) into the API build.
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  noExternal: ["@kalndlord/shared"],
  clean: true,
});
