import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Invoice } from "../types";

type TranslateFn = (key: string) => string;

type InventoryCreditSectionProps = {
  t: TranslateFn;
  invoices: Invoice[];
  overdueCredits: Invoice[];
};

export function InventoryCreditSection({
  t,
  invoices,
  overdueCredits,
}: InventoryCreditSectionProps) {
  return (
    <div className="space-y-4">
      {overdueCredits.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-2 text-amber-200">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-black">{t("inv.overdueAlert")}</p>
            <ul className="text-sm mt-1 list-disc ms-4">
              {overdueCredits.map((invoice) => (
                <li key={invoice.id}>
                  {invoice.customer_name || "—"} — {invoice.credit} MAD — {invoice.due_at}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader>
          <p className="font-black text-white">{t("inv.creditList")}</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="py-2 text-start">{t("inv.customer")}</th>
                <th className="py-2 text-start">{t("inv.total")}</th>
                <th className="py-2 text-start">{t("inv.paid")}</th>
                <th className="py-2 text-start">{t("inv.credit")}</th>
                <th className="py-2 text-start">{t("inv.dueDate")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-800/80 text-slate-200">
                  <td className="py-2">{invoice.customer_name || "—"}</td>
                  <td className="py-2">{invoice.total}</td>
                  <td className="py-2">{invoice.paid}</td>
                  <td className="py-2 text-orange-300">{invoice.credit}</td>
                  <td className="py-2 text-xs">{invoice.due_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
