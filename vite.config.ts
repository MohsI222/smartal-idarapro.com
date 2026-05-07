import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * Production — smartal-idarapro.com (or www):
 * • Production root host: **base is `/`** (default). Optional subpath only: set `VITE_BASE_PATH=/app/` and match CDN/nginx.
 * • Set `VITE_PUBLIC_APP_URL` at build time for canonical absolute URLs (see `.env.example`).
 * • SPA: serve `dist/index.html` for non-file routes; `vercel.json` handles the rewrite.
 * • API: reverse-proxy `/api` → Node, or set `VITE_API_URL` to the full API base.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const subpath = env.VITE_BASE_PATH?.trim();
  const base =
    !subpath || subpath === "/" ? "/" : `${subpath.startsWith("/") ? subpath : `/${subpath}`}`.replace(/\/?$/, "/");

  return {
    /** Supabase / لوحات Next تهيئ `NEXT_PUBLIC_*` — نفتحها فالبناء كي تعمل نفس `VITE_*` على Vercel */
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    base,
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
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("node_modules/recharts")) return "vendor-recharts";
            if (id.includes("node_modules/exceljs")) return "vendor-exceljs";
            if (id.includes("node_modules/xlsx")) return "vendor-xlsx";
            if (id.includes("node_modules/docx")) return "vendor-docx";
            if (id.includes("node_modules/jspdf")) return "vendor-jspdf";
            if (id.includes("node_modules/html2canvas")) return "vendor-html2canvas";
            if (id.includes("node_modules/@zxing")) return "vendor-zxing";
            if (id.includes("node_modules/tesseract.js")) return "vendor-tesseract";
            if (id.includes("node_modules/@ffmpeg")) return "vendor-ffmpeg";
            if (id.includes("node_modules/mammoth")) return "vendor-mammoth";
            if (id.includes("node_modules/@supabase")) return "vendor-supabase";
            if (id.includes("node_modules/lucide-react")) return "vendor-lucide";
            if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
            if (id.includes("node_modules/sonner")) return "vendor-sonner";
            if (
              id.includes("/node_modules/react/") ||
              id.includes("/node_modules/react-dom/") ||
              id.includes("/node_modules/react-router/")
            ) {
              return "vendor-react";
            }
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
