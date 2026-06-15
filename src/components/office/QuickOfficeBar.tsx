import { Link } from "react-router-dom";
import { FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  gridHref?: string;
  onProfessionalExcel?: () => void | Promise<void>;
  onProfessionalWord?: () => void | Promise<void>;
  disabledExcel?: boolean;
  disabledWord?: boolean;
  labels: {
    quickGrid: string;
    exportExcel: string;
    exportWord: string;
  };
};

/** أزرار سريعة: فتح شبكة البيانات + تصدير احترافي Excel / Word */
export function QuickOfficeBar({
  gridHref = "/app/inventory?tab=dash",
  onProfessionalExcel,
  onProfessionalWord,
  disabledExcel,
  disabledWord,
  labels,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="gap-1.5 border-emerald-500/40 text-emerald-100" asChild>
        <Link to={gridHref}>
          <Table2 className="size-4 shrink-0" />
          {labels.quickGrid}
        </Link>
      </Button>
      {onProfessionalExcel && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-[#0052CC]/50 text-sky-100"
          disabled={disabledExcel}
          onClick={() => void onProfessionalExcel()}
        >
          <FileSpreadsheet className="size-4 shrink-0" />
          {labels.exportExcel}
        </Button>
      )}
      {onProfessionalWord && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-orange-500/40 text-orange-100"
          disabled={disabledWord}
          onClick={() => void onProfessionalWord()}
        >
          <FileText className="size-4 shrink-0" />
          {labels.exportWord}
        </Button>
      )}
    </div>
  );
}
