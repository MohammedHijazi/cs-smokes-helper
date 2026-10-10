import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { editPlugin } from "./scripts/edit-plugin";

// Set by compose.yaml. In a container the dev server must listen beyond the container's own
// localhost, and poll for changes: file events from a Windows folder don't reach the container.
const inDocker = process.env.DEV_IN_DOCKER === "1";

export default defineConfig({
  base: "./",
  plugins: [react(), editPlugin({ anyAddress: inDocker })],
  server: inDocker
    ? {
        host: true,
        watch: {
          usePolling: true,
          interval: 300,
          ignored: ["**/.claude/**", "**/.superpowers/**", "**/dist/**", "**/tmp/**"],
        },
      }
    : undefined,
  preview: inDocker ? { host: true } : undefined,
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
