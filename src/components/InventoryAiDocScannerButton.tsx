import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractPlainTextFromInventoryFile, fetchVisionReceiptItems } from "@/lib/inventoryDocumentImport";
import type { VisionReceiptItem } from "@/lib/inventoryVisionTypes";

const ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Props = {
  token: string | null;
  label: string;
  onTextExtracted: (text: string) => void;
  /** عند نجاح استخراج GPT-4o vision — يتجاوز النص الخام */
  onVisionItems?: (items: VisionReceiptItem[]) => void;
  disabled?: boolean;
  variant?: "hero" | "compact";
};

export function InventoryAiDocScannerButton({
  token,
  label,
  onTextExtracted,
  onVisionItems,
  disabled,
  variant = "hero",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const run = async (file: File) => {
    setBusy(true);
    try {
      const mime = file.type || "";
      if (mime.startsWith("image/") && token && onVisionItems) {
        const vision = await fetchVisionReceiptItems(file, token);
        if (vision?.length) {
          onVisionItems(vision);
          return;
        }
      }
      const text = await extractPlainTextFromInventoryFile(file, token);
      onTextExtracted(text);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hero = variant === "hero";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className={
          hero
            ? "gap-3 min-h-[52px] px-6 text-base font-black bg-gradient-to-r from-[#0052CC] via-[#0066ff] to-cyan-500 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30 hover:brightness-110"
            : "gap-2"
        }
      >
        {busy ? <Loader2 className="size-6 animate-spin shrink-0" /> : <UploadCloud className={hero ? "size-8 shrink-0" : "size-5 shrink-0"} />}
        <span className="text-left leading-tight">{busy ? "…" : label}</span>
      </Button>
    </>
  );
}
