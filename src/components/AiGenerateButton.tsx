import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestAiGenerate } from "@/lib/aiClient";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

type Props = {
  module: string;
  context: Record<string, string>;
  onGenerated?: (text: string) => void;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  token?: string | null;
  locale?: string;
};

export function AiGenerateButton({
  module,
  context,
  onGenerated,
  variant = "outline",
  className,
  token: tokenProp,
  locale: localeProp,
}: Props) {
  const { token: ctxToken } = useAuth();
  const { t, locale: ctxLocale } = useI18n();
  const token = tokenProp ?? ctxToken;
  const locale = localeProp ?? ctxLocale;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setLoading(true);
    setProgress(0.08);
    const step = window.setInterval(() => {
      setProgress((p) => (p >= 0.92 ? p : p + 0.04 + Math.random() * 0.06));
    }, 220);
    try {
      const text = await requestAiGenerate(token, module, locale, context);
      setProgress(1);
      if (onGenerated) {
        onGenerated(text);
      } else {
        window.alert(text);
      }
    } catch {
      toast.error(t("ai.error"));
    } finally {
      window.clearInterval(step);
      setLoading(false);
      window.setTimeout(() => setProgress(0), 380);
    }
  };

  return (
    <div className="space-y-2 w-full max-w-md">
      <Button
        type="button"
        variant={variant}
        className={`relative overflow-hidden w-full ${className ?? ""}`}
        disabled={loading}
        onClick={() => void run()}
      >
        {loading && (
          <span
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              background: `linear-gradient(110deg, transparent 0%, rgba(0,200,255,0.9) ${Math.min(100, progress * 100)}%, transparent ${Math.min(100, progress * 100 + 18)}%)`,
            }}
            aria-hidden
          />
        )}
        <span className="relative z-[1] flex items-center justify-center gap-2">
          <Sparkles className={`size-4 text-amber-400 ${loading ? "animate-pulse" : ""}`} />
          {loading ? t("ai.generating") : t("ai.generate")}
        </span>
      </Button>
      {loading && (
        <div
          className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/10"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-out bg-gradient-to-r from-cyan-400 via-[#0052CC] to-fuchsia-500 shadow-[0_0_12px_rgba(0,200,255,0.5)]"
            style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
