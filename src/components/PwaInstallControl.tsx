import { useState } from "react";
import { Download, Monitor, Share2, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";

type Variant = "sidebar" | "header" | "bottomBar";

export function PwaInstallControl({
  variant,
  collapsedSidebar,
}: {
  variant: Variant;
  /** شريط جانبي مطوي — أيقونة فقط */
  collapsedSidebar?: boolean;
}) {
  const { t } = useI18n();
  const { canNativeInstall, installed, install, isIOS, isAndroid } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const runInstall = async () => {
    if (installed) return;
    if (canNativeInstall) {
      setBusy(true);
      try {
        const r = await install();
        if (r === "unavailable") setGuideOpen(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        disabled={installed || busy}
        onClick={() => void runInstall()}
        title={installed ? t("shell.pwaInstalled") : t("shell.installPwaHint")}
        className={cn(
          "font-bold shadow-lg transition-all duration-200 gap-2 border-2",
          variant === "sidebar" &&
            cn(
              "rounded-xl border-[#FF8C00]/50 bg-gradient-to-r from-[#0052CC]/25 to-[#0a1628] text-white hover:from-[#0052CC]/40 hover:border-[#FF8C00]/70 hover:shadow-[0_0_24px_rgba(0,82,204,0.35)]",
              collapsedSidebar
                ? "size-12 shrink-0 justify-center p-0 border-2"
                : "w-full justify-start px-3 py-3 text-sm"
            ),
          variant === "header" &&
            cn(
              "shrink-0 rounded-xl px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm border-[#FF8C00]/45 bg-gradient-to-r from-[#0052CC]/35 to-[#082040] text-white hover:from-[#0052CC]/50",
              !installed && "ring-2 ring-[#FF8C00]/30 shadow-[0_0_20px_rgba(255,140,0,0.15)]"
            ),
          variant === "bottomBar" &&
            "shrink-0 flex flex-col h-auto py-2 px-2.5 min-w-[4.5rem] rounded-xl border-[#FF8C00]/40 bg-[#0052CC]/20 text-[#FF8C00]",
          installed && "opacity-90 cursor-default border-emerald-500/40 bg-emerald-950/30 animate-none"
        )}
      >
        <Download
          className={cn(
            "shrink-0 text-[#FF8C00]",
            variant === "bottomBar" ? "size-6" : "size-5"
          )}
        />
        {variant === "sidebar" && !collapsedSidebar && (
          <span className="truncate">
            {installed ? t("shell.pwaInstalled") : t("shell.installPwa")}
          </span>
        )}
        {variant === "header" && (
          <span className="max-w-[100px] sm:max-w-[160px] truncate text-[11px] sm:text-sm font-black">
            {installed ? t("shell.pwaInstalledShort") : t("shell.installPwaShort")}
          </span>
        )}
        {variant === "bottomBar" && (
          <span className="text-[9px] font-black leading-tight text-center text-[#FF8C00]">
            {installed ? t("shell.pwaInstalledShort") : t("shell.installPwaShort")}
          </span>
        )}
      </Button>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-md border-[#0052CC]/40 bg-[#0a1628] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#FF8C00] text-xl">
              <Sparkles className="size-6" />
              {t("shell.pwaGuideTitle")}
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm leading-relaxed">
              {t("shell.pwaGuideIntro")}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-4 text-sm text-slate-200">
            {isIOS ? (
              <li className="flex gap-3">
                <Share2 className="size-5 shrink-0 text-[#0052CC] mt-0.5" />
                <span>{t("shell.pwaStepIOS")}</span>
              </li>
            ) : isAndroid ? (
              <li className="flex gap-3">
                <Smartphone className="size-5 shrink-0 text-[#0052CC] mt-0.5" />
                <span>{t("shell.pwaStepAndroid")}</span>
              </li>
            ) : (
              <>
                <li className="flex gap-3">
                  <Monitor className="size-5 shrink-0 text-[#0052CC] mt-0.5" />
                  <span>{t("shell.pwaStepDesktopChrome")}</span>
                </li>
                <li className="flex gap-3">
                  <Download className="size-5 shrink-0 text-[#0052CC] mt-0.5" />
                  <span>{t("shell.pwaStepDesktopEdge")}</span>
                </li>
              </>
            )}
          </ul>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-700">{t("shell.pwaGuideFooter")}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
