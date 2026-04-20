import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";
import type { VisionReceiptItem } from "@/lib/inventoryVisionTypes";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** استخراج نص موحّد من صورة / Excel / PDF / Word */
export async function extractPlainTextFromInventoryFile(file: File, token: string | null): Promise<string> {
  const ext = extOf(file.name);
  const mime = file.type || "";

  if (mime.startsWith("image/")) {
    const r = await Tesseract.recognize(file, "ara+eng+fra", {});
    return (r.data.text || "").trim();
  }

  if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheet")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const name = wb.SheetNames[0];
    const sheet = name ? wb.Sheets[name] : null;
    if (!sheet) return "";
    return XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
  }

  if (ext === "pdf" || mime === "application/pdf") {
    if (!token) throw new Error("auth");
    const fd = new FormData();
    fd.append("file", file, file.name);
    const res = await fetch("/api/inventory/extract-document-text", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || "PDF extract failed");
    }
    const j = (await res.json()) as { text?: string };
    return (j.text || "").trim();
  }

  if (ext === "docx" || ext === "doc" || mime.includes("wordprocessingml") || mime.includes("msword")) {
    if (!token) throw new Error("auth");
    const fd = new FormData();
    fd.append("file", file, file.name);
    const res = await fetch("/api/inventory/extract-document-text", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || "Word extract failed");
    }
    const j = (await res.json()) as { text?: string };
    return (j.text || "").trim();
  }

  throw new Error("unsupported file type");
}

/** GPT-4o vision على الخادم — يعيد null إن لم يُضبط المفتاح أو فشل الطلب */
export async function fetchVisionReceiptItems(
  file: File,
  token: string | null
): Promise<VisionReceiptItem[] | null> {
  if (!token) return null;
  const mime = file.type || "";
  if (!mime.startsWith("image/")) return null;
  const fd = new FormData();
  fd.append("file", file, file.name || "scan.jpg");
  const res = await fetch("/api/inventory/vision-extract-receipt", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (res.status === 503) return null;
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Vision extract failed");
  }
  const j = (await res.json()) as { items?: VisionReceiptItem[] };
  const items = Array.isArray(j.items) ? j.items : [];
  return items.length ? items : null;
}
