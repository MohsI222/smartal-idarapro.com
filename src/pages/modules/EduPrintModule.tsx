import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportEduPrintColorPdf } from "@/lib/pdfExport";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

export function EduPrintModule() {
  const { t, isRtl, locale } = useI18n();
  const { isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("edu_print");
  const [logoUrl, setLogoUrl] = useState("");
  const [institution, setInstitution] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportEduPrintColorPdf(
        {
          logoUrl,
          institution,
          examTitle,
          subject,
          teacher,
          labels: {
            institution: t("eduPrint.institution"),
            examTitle: t("eduPrint.examTitle"),
            subject: t("eduPrint.subject"),
            teacher: t("eduPrint.teacher"),
            footer: t("eduPrint.pdfFooter"),
          },
        },
        `edu-exam-${Date.now()}.pdf`,
        isRtl ? "rtl" : "ltr",
        locale.startsWith("ar") ? "ar" : "en",
        t("brand"),
        locale
      );
    } finally {
      setExporting(false);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("eduPrint.lockedTitle")}</h2>
        <p className="text-slate-400 text-sm">{t("eduPrint.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{t("eduPrint.title")}</h1>
        <p className="text-slate-400 mt-1 font-semibold">{t("eduPrint.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-800/80 bg-[#0a1628]/80">
          <CardHeader>
            <h2 className="text-lg font-black text-white">{t("eduPrint.formTitle")}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo" className="font-bold text-white">
                {t("eduPrint.logoUrl")}
              </Label>
              <Input
                id="logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="bg-[#050a12] border-slate-700 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst" className="font-bold text-white">
                {t("eduPrint.institution")}
              </Label>
              <Input
                id="inst"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="bg-[#050a12] border-slate-700 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam" className="font-bold text-white">
                {t("eduPrint.examTitle")}
              </Label>
              <Input
                id="exam"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                className="bg-[#050a12] border-slate-700 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject" className="font-bold text-white">
                {t("eduPrint.subject")}
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-[#050a12] border-slate-700 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher" className="font-bold text-white">
                {t("eduPrint.teacher")}
              </Label>
              <Input
                id="teacher"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                className="bg-[#050a12] border-slate-700 font-medium"
              />
            </div>
            <Button
              type="button"
              disabled={exporting}
              onClick={() => void exportPdf()}
              className="w-full font-black bg-[#0052CC] hover:bg-[#0044a8] text-white shadow-lg"
            >
              <FileDown className="size-4" />
              {exporting ? t("eduPrint.exporting") : t("eduPrint.printPdf")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-[#0a1628]/80">
          <CardHeader>
            <h2 className="text-lg font-black text-white">{t("eduPrint.preview")}</h2>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl overflow-hidden border-2 border-slate-600/50 shadow-2xl min-h-[480px]"
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className="bg-white text-slate-900 p-6 md:p-8">
                <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
                  <div className="bg-gradient-to-br from-[#0052CC] via-[#1d4ed8] to-[#FF8C00] px-5 py-6 text-white">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
                      {t("eduPrint.institution")}
                    </p>
                    <p className="text-xl md:text-2xl font-black mt-2 leading-tight">
                      {institution || "—"}
                    </p>
                    <div className="mt-4 pt-4 border-t border-white/30">
                      <p className="text-lg md:text-xl font-black text-amber-100 drop-shadow-sm">
                        {examTitle || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="p-5 space-y-3 bg-slate-50">
                    <div className="flex justify-between gap-4 items-center rounded-lg bg-blue-50 border-s-4 border-[#0052CC] px-4 py-3">
                      <span className="text-xs font-black text-blue-900 uppercase">{t("eduPrint.subject")}</span>
                      <span className="font-bold text-blue-950">{subject || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4 items-center rounded-lg bg-amber-50 border-s-4 border-[#FF8C00] px-4 py-3">
                      <span className="text-xs font-black text-amber-900 uppercase">{t("eduPrint.teacher")}</span>
                      <span className="font-bold text-amber-950">{teacher || "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-20 object-contain max-w-full" />
                  ) : (
                    <div className="h-16 w-40 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-bold">
                      {t("eduPrint.logoPlaceholder")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
