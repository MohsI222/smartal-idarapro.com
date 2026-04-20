import { useMemo, useState } from "react";
import { Car, Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/I18nProvider";

const MODELS = [
  "Dacia Logan / Sandero",
  "Peugeot 208 / 308",
  "Renault Clio / Megane",
  "Volkswagen Golf / Polo",
  "Mercedes C-Class",
  "BMW Série 3",
];

export function TechAutoModule() {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState("");
  const [model, setModel] = useState(MODELS[0]);

  const hint = useMemo(() => {
    const c = code.trim().toUpperCase();
    if (!c) return t("techauto.searchHint");
    if (c.startsWith("P0")) return t("techauto.obd.powertrain");
    if (c.startsWith("P1")) return t("techauto.obd.generic");
    if (c.startsWith("C")) return t("techauto.obd.chassis");
    return t("techauto.obd.lookup");
  }, [code, t]);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start gap-4">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#0052CC]/20 border border-[#0052CC]/40 shrink-0">
          <Wrench className="size-6 text-[#FF8C00]" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t("techauto.title")}</h1>
          <p className="text-slate-400 mt-1">{t("techauto.subtitle")}</p>
        </div>
      </div>

      <Card className="border-slate-800/80 bg-[#0a1628]/80">
        <CardHeader>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Search className="size-5 text-[#0052CC]" />
            {t("techauto.diagnosisTitle")}
          </h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="obd">{t("techauto.obdCode")}</Label>
            <div className="relative">
              <Input
                id="obd"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="P0420"
                className="bg-[#050a12] border-slate-700 font-mono uppercase pr-10"
              />
              <Search className="absolute top-1/2 -translate-y-1/2 size-4 text-slate-500 end-3" />
            </div>
            <p className="text-xs text-[#FF8C00]/90">{hint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-2">
              <Car className="size-4 text-slate-400" />
              {t("techauto.carModel")}
            </Label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-700 bg-[#050a12] px-3 text-sm text-white"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prob">{t("techauto.problemDesc")}</Label>
            <textarea
              id="prob"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-slate-700 bg-[#050a12] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/50"
              placeholder={t("techauto.problemPlaceholder")}
            />
          </div>

          <Button type="button" className="bg-[#0052CC] hover:bg-[#0044a8]">
            {t("techauto.saveReport")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
