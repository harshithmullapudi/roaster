import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** `~/` is a tsconfig path, which vitest resolves only if it is told to. */
export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
