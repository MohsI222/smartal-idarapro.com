// MUST be the first import — patches Intl globally and installs body-level digit sweeper
import "@/lib/installLatinDigitGuard";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { scheduleExportLibrariesWarmup } from "@/lib/exportLibraries";

scheduleExportLibrariesWarmup();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      const base = import.meta.env.BASE_URL ?? "/";
      const swUrl = base.endsWith("/") ? `${base}sw.js` : `${base}/sw.js`;
      void navigator.serviceWorker.register(swUrl).catch(() => undefined);
    });
  } else {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.unregister());
      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
    });
  }
}
