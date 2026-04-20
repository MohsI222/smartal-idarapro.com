import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * Production — smartal-idarapro.com (or www):
 * • `VITE_BASE_PATH=/` (default): assets at `https://www.smartal-idarapro.com/assets/...`.
 * • Set `VITE_PUBLIC_APP_URL` at build time to your canonical HTTPS URL (see `.env.example`).
 * • Subpath deploy only: `VITE_BASE_PATH=/app/` and match nginx/CDN.
 * • SPA: serve `dist/index.html` for non-file routes; `vercel.json` handles the rewrite.
 * • API: reverse-proxy `/api` → Node, or set `VITE_API_URL` to the full API base.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const baseRaw = env.VITE_BASE_PATH?.trim() || "/";
  const base = baseRaw.startsWith("/") ? baseRaw : `/${baseRaw}`;
  const baseNormalized = base.endsWith("/") ? base : `${base}/`;

  return {
    base: baseNormalized,
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ["jspdf", "html2canvas", "exceljs", "docx"],
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: "http://localhost:4000", changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      strictPort: false,
      proxy: {
        "/api": { target: "http://localhost:4000", changeOrigin: true },
      },
    },
    build: {
      target: "es2022",
      cssMinify: true,
      chunkSizeWarningLimit: 1200,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/recharts")) return "recharts";
            return undefined;
          },
        },
      },
    },
    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
  };
});
