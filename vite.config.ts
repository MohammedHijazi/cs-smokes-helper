import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { editPlugin } from "./scripts/edit-plugin";

export default defineConfig({
  base: "./",
  plugins: [react(), editPlugin()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
