import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Identifica cada build para o UpdateNotifier: uma aba aberta desde antes de um
// deploy roda o bundle antigo em memoria e nao percebe sozinha que ha uma
// versao nova (foi o que causou a cotacao impressa com o layout de ontem).
const BUILD_ID = String(Date.now());

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "write-build-version",
      apply: "build",
      writeBundle(options) {
        const outDir = options.dir ?? "dist";
        fs.writeFileSync(path.resolve(outDir, "version.json"), JSON.stringify({ buildId: BUILD_ID }));
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
