import { DocumentSummarizer } from "@/components/ai/DocumentSummarizer";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/context/AuthContext";
import { Lock } from "lucide-react";

export function AiAssistantModule() {
  const { t, locale } = useI18n();
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto mt-20">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">المساعد البرمجي - خاص بالسوبر أدمن</h2>
        <p className="text-slate-400">هذا القسم متاح فقط للمسؤولين على المنصة</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">
            {locale === "ar-MA" || locale === "ar"
              ? "التلخيص الآلي للوثائق"
              : "Document Summarization"}
          </h1>
          <p className="text-slate-400">
            {locale === "ar-MA" || locale === "ar"
              ? "أداة ذكية لتلخيص الوثائق والملفات PDF"
              : "Smart tool for summarizing documents and PDF files"}
          </p>
        </div>

        <DocumentSummarizer />
      </div>
    </div>
  );
}
