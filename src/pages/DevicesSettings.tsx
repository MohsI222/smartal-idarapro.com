import { useEffect, useState } from "react";
import { FileSpreadsheet, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { getExcelOnlineSyncEnabled, setExcelOnlineSyncEnabled } from "@/lib/excelOnlineSync";

export function DevicesSettings() {
  const { token, devices, maxDevices, refresh } = useAuth();
  const { t } = useI18n();
  const [excelSync, setExcelSync] = useState(false);

  useEffect(() => {
    setExcelSync(getExcelOnlineSyncEnabled());
  }, []);

  const remove = async (deviceId: string) => {
    if (!token || !confirm(t("devices.deleteConfirm"))) return;
    await api("/devices/remove", {
      method: "POST",
      token,
      body: JSON.stringify({ deviceId }),
    });
    await refresh();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Smartphone className="size-8 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold">{t("devices.title")}</h1>
          <p className="text-slate-400 text-sm">
            {t("devices.subtitle").replace("{max}", String(maxDevices))}
          </p>
        </div>
      </div>

      <Card className="border-slate-800 border-[#003876]/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-emerald-400" />
            {t("excelSync.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-400 leading-relaxed">{t("excelSync.desc")}</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-slate-600"
              checked={excelSync}
              onChange={(e) => {
                const v = e.target.checked;
                setExcelSync(v);
                setExcelOnlineSyncEnabled(v);
              }}
            />
            <span className="text-sm text-slate-300">{t("excelSync.enable")}</span>
          </label>
          <p className="text-xs text-slate-600">
            → {t("dashboard.importExcelSync")} / {t("dashboard.exportExcelSync")}
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">
            {t("devices.registered")} ({devices.length}/{maxDevices})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 ? (
            <p className="text-slate-500 text-sm">{t("devices.empty")}</p>
          ) : (
            devices.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.label ?? t("devices.device")}</p>
                  <p className="text-xs text-slate-500 truncate">{d.fingerprint.slice(0, 12)}…</p>
                  <p className="text-xs text-slate-600">
                    {t("devices.lastSeen")}: {d.last_seen}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => void remove(d.id)}
                  aria-label={t("devices.deleteAria")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
