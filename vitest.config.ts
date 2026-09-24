import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Mesmo __BUILD_ID__ que vite.config.ts injeta em build/dev — sem isto o
  // UpdateNotifier (src/components/UpdateNotifier.tsx) lanca ReferenceError
  // ao rodar sob vitest, que nao usa vite.config.ts.
  define: {
    __BUILD_ID__: JSON.stringify("test-build-id"),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
