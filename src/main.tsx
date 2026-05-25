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

// Global error surface: show a friendly overlay when an uncaught error/rejection
// (for example caused by a browser extension) would otherwise leave the UI blank.
function showFatalOverlay(msg: string) {
  try {
    if (document.getElementById("idara-fatal-overlay")) return;
    const o = document.createElement("div");
    o.id = "idara-fatal-overlay";
    Object.assign(o.style, {
      position: "fixed",
      inset: "0",
      background: "linear-gradient(180deg, rgba(10,16,40,0.95), rgba(2,6,23,0.95))",
      color: "white",
      zIndex: "999999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    } as Partial<CSSStyleDeclaration>);
    o.innerHTML = `
      <div style="max-width:880px;text-align:center">
        <h1 style="font-size:20px;margin-bottom:8px">واجه التطبيق خطأ غير متوقع</h1>
        <p style="color:#cbd5e1;margin-bottom:18px;white-space:pre-wrap">${String(msg).slice(0, 1000)}</p>
        <div style="display:flex;gap:12px;justify-content:center">
          <button id="idara-fatal-clear" style="background:#0052CC;border:none;padding:10px 16px;border-radius:8px;color:white;font-weight:600;">مسح التخزين وإعادة التحميل</button>
          <button id="idara-fatal-doc" style="background:transparent;border:1px solid #94a3b8;padding:10px 16px;border-radius:8px;color:#cbd5e1;">تعليمات تعطيل الإضافات</button>
        </div>
        <p style="margin-top:14px;color:#94a3b8;font-size:13px">إذا استمر الخطأ، عطّل الإضافات (مثل Ginger) مؤقتاً ثم حدّث الصفحة.</p>
      </div>
    `;
    document.body.appendChild(o);
    document.getElementById("idara-fatal-clear")?.addEventListener("click", async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        localStorage.removeItem("idara_token");
      } catch {
        /* ignore */
      }
      location.reload();
    });
    document.getElementById("idara-fatal-doc")?.addEventListener("click", () => {
      // Open a short help page (could be external); for now show simple alert
      alert("تعطيل الإضافات: افتح Chrome → More tools → Extensions → عطل Ginger أو أي إضافة مشبوهة، ثم عدّ تحميل الصفحة.");
    });
  } catch {
    /* defensive */
  }
}

function showNonFatalBanner(msg: string) {
  try {
    if (document.getElementById("idara-nonfatal-banner")) return;
    const b = document.createElement("div");
    b.id = "idara-nonfatal-banner";
    Object.assign(b.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      background: "rgba(5,11,20,0.9)",
      color: "#e2e8f0",
      padding: "10px 12px",
      borderRadius: "10px",
      zIndex: "999999",
      maxWidth: "360px",
      boxShadow: "0 6px 18px rgba(2,6,23,0.6)",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
      fontSize: "13px",
    } as Partial<CSSStyleDeclaration>);
    b.innerHTML = `<div style="margin-bottom:8px;font-weight:600">مشكلة ملحق متصفّح</div><div style=\"color:#cbd5e1;margin-bottom:10px;white-space:pre-wrap;max-height:88px;overflow:auto\">${String(msg).slice(0, 800)}</div><div style=\"display:flex;gap:8px;justify-content:flex-end\"><button id=\"idara-nonfatal-doc\" style=\"background:transparent;border:1px solid #334155;padding:6px 8px;border-radius:6px;color:#cbd5e1;\">تعليمات</button><button id=\"idara-nonfatal-dismiss\" style=\"background:#0052CC;border:none;padding:6px 8px;border-radius:6px;color:white\">إغلاق</button></div>`;
    document.body.appendChild(b);
    document.getElementById("idara-nonfatal-doc")?.addEventListener("click", () => {
      alert("تعطيل الإضافات: افتح Chrome → More tools → Extensions → عطل Ginger أو أي إضافة مشبوهة، ثم حدّث الصفحة.");
    });
    document.getElementById("idara-nonfatal-dismiss")?.addEventListener("click", () => {
      b.remove();
    });
  } catch {
    /* ignore */
  }
}

const NON_FATAL_ERROR_PATTERNS = /(ginger|writer\.min\.js|elementFromPoint|extension|content\.min\.js)/i;

window.addEventListener("error", (ev) => {
  try {
    const msg = (ev as ErrorEvent)?.error?.message ?? (ev as ErrorEvent).message ?? String(ev);
    if (NON_FATAL_ERROR_PATTERNS.test(String(msg)) || NON_FATAL_ERROR_PATTERNS.test(String((ev as ErrorEvent).filename || ""))) {
      console.warn("Non-fatal extension error intercepted:", msg);
      showNonFatalBanner(msg);
      return;
    }
    showFatalOverlay(msg);
  } catch {
    /* ignore */
  }
});
window.addEventListener("unhandledrejection", (ev) => {
  try {
    const reason = (ev as PromiseRejectionEvent & any)?.reason || "Unhandled promise rejection";
    const rstr = String(reason);
    if (NON_FATAL_ERROR_PATTERNS.test(rstr)) {
      console.warn("Non-fatal extension rejection intercepted:", rstr);
      showNonFatalBanner(rstr);
      return;
    }
    showFatalOverlay(rstr);
  } catch {
    /* ignore */
  }
});
