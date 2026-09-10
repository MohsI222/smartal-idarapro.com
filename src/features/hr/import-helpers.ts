import { getApiUrlPrefix } from "@/lib/api";
import { readXlsxWorkbookFromFile, sheetToAoa } from "@/services/fileService";
import { parseHrDocumentText, parseHrImportRows } from "./employee-helpers";
import type { HrEmployeeDraft } from "./types";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

async function extractTextFromHrDocument(file: File, token: string | null): Promise<string> {
  if (!token) throw new Error("Authentication required");
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch(`${getApiUrlPrefix()}/hr/extract-document-text`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Document extract failed");
  }
  const j = (await res.json()) as { text?: string };
  return String(j.text || "").trim();
}

export async function parseHrImportFile(
  file: File,
  token: string | null
): Promise<{
  drafts: HrEmployeeDraft[];
  sourceLabel: string;
}> {
  const ext = extOf(file.name);
  const mime = file.type || "";

  if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheet")) {
    const wb = await readXlsxWorkbookFromFile(file);
    const firstSheetName = wb.SheetNames[0];
    const firstSheet = firstSheetName ? wb.Sheets[firstSheetName] : null;
    const drafts = firstSheet ? parseHrImportRows(sheetToAoa(firstSheet)) : [];
    return { drafts, sourceLabel: file.name };
  }

  if (
    ext === "pdf" ||
    ext === "docx" ||
    ext === "doc" ||
    mime === "application/pdf" ||
    mime.includes("wordprocessingml") ||
    mime.includes("msword")
  ) {
    const text = await extractTextFromHrDocument(file, token);
    const draft = parseHrDocumentText(text);
    return { drafts: draft.name ? [draft] : [], sourceLabel: file.name };
  }

  throw new Error("Unsupported file type");
}
