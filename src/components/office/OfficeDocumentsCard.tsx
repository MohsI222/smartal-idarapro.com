import { useCallback, useRef, useState } from "react";
import { Eye, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  listOfficeStash,
  previewDocxAsHtml,
  readXlsxWorkbookFromFile,
  removeOfficeStashEntry,
  saveOfficeFileToStash,
  sheetToAoa,
  withFileToast,
  type StashedOfficeFile,
} from "@/services/fileService";
import { toast } from "sonner";

type Props = {
  title: string;
  subtitle: string;
  uploadLabel: string;
  previewLabel: string;
  saveLabel: string;
  stashTitle: string;
};

export function OfficeDocumentsCard({ title, subtitle, uploadLabel, previewLabel, saveLabel, stashTitle }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<(string | number | null)[][] | null>(null);
  const [stash, setStash] = useState<StashedOfficeFile[]>(() => listOfficeStash());

  const refreshStash = useCallback(() => setStash(listOfficeStash()), []);

  const loadPreview = async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    setPreviewHtml(null);
    setPreviewRows(null);
    await withFileToast(async () => {
      if (ext === "docx") {
        const html = await previewDocxAsHtml(f);
        setPreviewHtml(html);
        return;
      }
      if (ext === "xlsx" || ext === "xls") {
        const wb = await readXlsxWorkbookFromFile(f);
        const name = wb.SheetNames[0];
        const ws = name ? wb.Sheets[name] : null;
        if (!ws) return;
        const aoa = sheetToAoa(ws);
        setPreviewRows(aoa.slice(0, 80));
        return;
      }
      toast.message("Use .xlsx or .docx");
    }, "Preview failed");
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    await loadPreview(f);
  };

  const onSave = async () => {
    if (!file) return;
    await withFileToast(async () => {
      await saveOfficeFileToStash(file);
      refreshStash();
    }, "Save failed");
  };

  return (
    <Card className="border-white/10 bg-[#0a1628]/80 backdrop-blur-xl">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Upload className="size-5 text-[#FF8C00]" />
            {title}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(ev) => void onPick(ev)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2 bg-white/10"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploadLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2 bg-white/10"
            disabled={!file}
            onClick={() => file && void loadPreview(file)}
          >
            <Eye className="size-4" />
            {previewLabel}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="gap-2 bg-emerald-950/50 border border-emerald-600/30" disabled={!file} onClick={() => void onSave()}>
            <Save className="size-4" />
            {saveLabel}
          </Button>
        </div>

        {previewHtml && (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3 max-h-64 overflow-auto text-sm prose prose-invert max-w-none text-slate-200"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
        {previewRows && previewRows.length > 0 && (
          <div className="rounded-lg border border-white/10 overflow-auto max-h-64">
            <table className="w-full text-xs text-left border-collapse">
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? "bg-[#003876]/80 text-white font-semibold" : ri % 2 ? "bg-white/5" : ""}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-white/10 px-2 py-1 whitespace-nowrap max-w-[200px] truncate">
                        {cell ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400">{stashTitle}</p>
          <ul className="space-y-1">
            {stash.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-xs text-slate-300 rounded-md bg-white/5 px-2 py-1.5">
                <span className="truncate">{s.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-red-300 hover:text-red-100"
                  onClick={() => {
                    removeOfficeStashEntry(s.id);
                    refreshStash();
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
            {stash.length === 0 && <li className="text-xs text-slate-500">—</li>}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
