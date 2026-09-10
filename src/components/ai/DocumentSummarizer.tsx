import { useState, useRef } from "react";
import { FileText, Upload, Sparkles, Loader2, Download, Copy, Check, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeDocument } from "@/lib/geminiClient";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import * as pdfjsLib from "pdfjs-dist";

// Bulletproof dynamic PDF worker setup using unpkg CDN
const pdfjsVersion = pdfjsLib.version || '3.11.174';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.js`;

export function DocumentSummarizer() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { isSpeaking, currentMessageId, toggleSpeech } = useTextToSpeech();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setSummary("");
    } else {
      toast.error(locale.startsWith("ar")
        ? "يرجى اختيار ملف PDF فقط"
        : "Please select a PDF file only");
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += `\n\n--- Page ${i} ---\n\n${pageText}`;
        } catch (pageError) {
          console.error(`Error extracting text from page ${i}:`, pageError);
          fullText += `\n\n--- Page ${i} (Error) ---\n\n`;
        }
      }

      return fullText;
    } catch (error) {
      console.error("Error loading PDF:", error);
      throw new Error(locale.startsWith("ar")
        ? "فشل في قراءة ملف PDF. تأكد أن الملف غير تالف."
        : "Failed to read PDF file. Make sure the file is not corrupted.");
    }
  };

  const handleSummarize = async () => {
    if (!file || loading) return;

    setLoading(true);
    try {
      const text = await extractTextFromPDF(file);
      
      if (text.trim().length === 0) {
        toast.error(locale.startsWith("ar")
          ? "لم يتم العثور على نص في ملف PDF"
          : "No text found in the PDF file");
        setLoading(false);
        return;
      }

      const summaryText = await summarizeDocument(token, text, locale);
      setSummary(summaryText);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : t("ai.error");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(locale.startsWith("ar")
        ? "تم نسخ التلخيص"
        : "Summary copied");
    }
  };

  const handleDownload = () => {
    if (summary) {
      const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `summary-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Card className="border-slate-800 bg-[#0a1628]/90 w-full max-w-4xl mx-auto">
      <CardHeader className="border-b border-slate-800">
        <CardTitle className="flex items-center gap-2 text-cyan-400">
          <Sparkles className="size-5" />
          {locale.startsWith("ar")
            ? "التلخيص الآلي للوثائق"
            : "Document Summarization"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-cyan-500/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="size-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-300 mb-2">
              {locale.startsWith("ar")
                ? "اضغط لرفع ملف PDF"
                : "Click to upload a PDF file"}
            </p>
            <p className="text-sm text-slate-500">
              {locale.startsWith("ar")
                ? "الحد الأقصى: 10 ميجابايت"
                : "Max size: 10MB"}
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-cyan-400" />
                <div>
                  <p className="text-sm text-slate-200 font-medium">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setSummary("");
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                {locale.startsWith("ar") ? "إزالة" : "Remove"}
              </Button>
            </div>
          )}

          <Button
            onClick={handleSummarize}
            disabled={!file || loading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {locale.startsWith("ar")
                  ? "جاري التلخيص..."
                  : "Summarizing..."}
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                {locale.startsWith("ar")
                  ? "تلخيص الوثيقة"
                  : "Summarize Document"}
              </>
            )}
          </Button>
        </div>

        {summary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-cyan-400">
                {locale.startsWith("ar")
                  ? "الملخص"
                  : "Summary"}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSpeech(summary, "summary")}
                  className={`border-slate-700 ${isSpeaking && currentMessageId === "summary" ? 'text-cyan-400 animate-pulse' : 'text-slate-300'} hover:bg-slate-800`}
                >
                  {isSpeaking && currentMessageId === "summary" ? (
                    <VolumeX className="size-4" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Download className="size-4" />
                </Button>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="prose prose-invert prose-sm max-w-none">
                {summary.split("\n").map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 20)}`} className="text-slate-200 leading-relaxed mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
