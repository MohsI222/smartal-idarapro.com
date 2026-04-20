/** اتصال بالخدمات السحابية/الخادم للتصدير — يقرأ الرمز من localStorage تلقائياً */

const TOKEN_KEY = "idara_token";

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function postBackendXlsxStream(body: {
  fileName: string;
  sheets: { name: string; rows: (string | number | null | undefined)[][]; rtl?: boolean }[];
}): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/backend/xlsx-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = body.fileName.endsWith(".xlsx") ? body.fileName : `${body.fileName}.xlsx`;
    a.style.setProperty("display", "none");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** النظام الأساسي للشركة — OOXML حقيقي من الخادم */
export async function postBackendStatutsDocx(
  fileName: string,
  locale: string,
  payload: Record<string, string>
): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/backend/docx-statuts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fileName, locale, payload }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
    a.style.setProperty("display", "none");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** تقرير إداري بجدول — قالب Word احترافي */
export async function postBackendReportDocx(body: {
  fileName: string;
  kingdomLine?: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  rtl?: boolean;
}): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/backend/docx-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = body.fileName.endsWith(".docx") ? body.fileName : `${body.fileName}.docx`;
    a.style.setProperty("display", "none");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function postBackendLegalDocx(payload: unknown, fileName: string): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  try {
    const res = await fetch("/api/backend/docx-legal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fileName, payload }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export type BackendPrintHtmlBody = {
  direction: "rtl" | "ltr";
  lang: string;
  kingdomLine: string;
  sectionTitle: string;
  mainTitle?: string;
  innerHtml: string;
  mode?: "official" | "platform" | "creative";
  logoDataUrl?: string;
};

/** يجلب HTML كاملاً من الخادم (خطوط/شعار مضمّنة) — للتحويل إلى PDF عبر Canvas محلياً */
export async function fetchBackendPrintHtml(body: BackendPrintHtmlBody): Promise<string | null> {
  const token = getStoredAuthToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/backend/print-html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { html?: string };
    return data.html?.trim() ? data.html : null;
  } catch {
    return null;
  }
}

export type PromoVideoBackendResult =
  | { ok: true; url: string; provider: string }
  | { ok: false; fallback: true; message?: string; imageUrls?: string[] };

export async function postBackendPromoVideo(fd: FormData): Promise<PromoVideoBackendResult> {
  const token = getStoredAuthToken();
  if (!token) return { ok: false, fallback: true, message: "no token" };
  try {
    const res = await fetch("/api/backend/promo-video", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      provider?: string;
      fallback?: boolean;
      message?: string;
      imageUrls?: string[];
    };
    if (res.ok && data.url)
      return { ok: true, url: data.url, provider: data.provider ?? "shotstack" };
    return {
      ok: false,
      fallback: true,
      message: data.message,
      imageUrls: data.imageUrls,
    };
  } catch {
    return { ok: false, fallback: true };
  }
}
