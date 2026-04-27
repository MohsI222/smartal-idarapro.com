import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Link } from "react-router-dom";
import {
  Download,
  FileEdit,
  FileSpreadsheet,
  FileType2,
  FileText,
  Lock,
  MessageCircle,
  Mic,
  MicOff,
  Save,
  ScanLine,
  Scale,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { OcrScanner, parseMoroccanIdHints } from "@/components/OcrScanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRequestGroupIdForType, LEGAL_REQUEST_GROUPS } from "@/constants/legalRequestTypes";
import type { LegalServiceCenterId } from "@/constants/legalServiceCenters";
import {
  LEGAL_ADMIN_CENTER_IDS,
  LEGAL_COURT_CENTER_IDS,
  LEGAL_OTHER_CENTER_IDS,
} from "@/constants/legalServiceCenters";
import {
  arabicOfficialLine,
  buildLegalRequestDraft,
  formatDocumentDate,
} from "@/lib/legalRequestDraft";
import { formatEnGbShortDateLatin, formatLatinDateDMYFromIsoDate } from "@/lib/latinNumeralFormat";
import { todayIsoLocal } from "@/lib/todayIso";
import {
  downloadLegalDocumentDocx,
  downloadLegalDocumentXlsx,
  openLegalDocumentOfficialPdf,
  type LegalExportPayload,
} from "@/lib/legalDocumentExport";
import {
  moroccanDocumentClassLabel,
  moroccanInstitutionLabel,
  type MoroccanDocumentClass,
  type MoroccanInstitutionType,
} from "@/lib/moroccanLegalVariables";
import { downloadLegalAdministrativeSheetPdf } from "@/lib/legalAdministrativeSheetPdf";
import { isAddressChangeRequestProfile } from "@/lib/legalAdministrativePdfContent";
import type { AppLocale } from "@/i18n/strings";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { toWesternDigits } from "@/lib/utils";
import { useSpeechToText } from "@/hooks/useSpeechToText";

const STORAGE_KEY = "legal_editor_form";

/** نص محاكاة OCR للبطاقة الوطنية — يتوافق مع parseMoroccanIdHints */
const SIMULATED_CNIE_OCR = `
اللقب : المالكي
الاسم الشخصي : يحيى
العنوان : الرباط، حي حسان، زنقة الأمل رقم 12
N° CIN : AB123456
`;

const INSTITUTION_OPTIONS: MoroccanInstitutionType[] = [
  "court_first_instance",
  "court_commercial",
  "court_appeal",
  "court_family",
  "court_military",
];

const DOCUMENT_CLASS_OPTIONS: MoroccanDocumentClass[] = [
  "minutes",
  "opening_petition",
  "complaint",
  "admin_request",
];

type FormState = {
  fullName: string;
  nationalId: string;
  address: string;
  phone: string;
  email: string;
  /** صيغة التوجيه الرسمية — تظهر في وسط الورقة عند الطباعة */
  formalRecipientLine: string;
  recipientEntity: string;
  serviceCenterId: LegalServiceCenterId;
  documentDate: string;
  requestTypeId: string;
  customRequestLabel: string;
  requestDetails: string;
  institutionTypeId: MoroccanInstitutionType;
  documentClassId: MoroccanDocumentClass;
};

const initialForm: FormState = {
  fullName: "LAHCEN EL MOUTAOUAKIL",
  nationalId: "",
  address: "",
  phone: "",
  email: "",
  formalRecipientLine: "",
  recipientEntity: "",
  serviceCenterId: "admin_commune",
  /* `type="date"` value is local YYYY-MM-DD; en-GB Latin line: `documentDateEnGb` */
  documentDate: "",
  requestTypeId: "residence_certificate",
  customRequestLabel: "",
  requestDetails: "",
  institutionTypeId: "court_first_instance",
  documentClassId: "admin_request",
};

function loadFormState(): FormState {
  const base: FormState = {
    ...initialForm,
    documentDate: todayIsoLocal(),
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return {
      ...base,
      ...parsed,
      documentDate: parsed.documentDate?.trim() ? parsed.documentDate : base.documentDate,
      serviceCenterId: (parsed.serviceCenterId as LegalServiceCenterId) ?? base.serviceCenterId,
      requestTypeId: parsed.requestTypeId ?? base.requestTypeId,
      formalRecipientLine:
        typeof parsed.formalRecipientLine === "string" ? parsed.formalRecipientLine : base.formalRecipientLine,
      institutionTypeId: (parsed.institutionTypeId as MoroccanInstitutionType) ?? base.institutionTypeId,
      documentClassId: (parsed.documentClassId as MoroccanDocumentClass) ?? base.documentClassId,
    };
  } catch {
    return base;
  }
}

/** يمنع تكرار سطر التوجيه في كتلة الطباعة عندما يطابق أول سطر في النص */
function stripLeadingFormalLine(formal: string, details: string): string {
  const f = formal.trim();
  if (!f) return details;
  const lines = details.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  if (lines[i]?.trim() === f) {
    return lines
      .slice(i + 1)
      .join("\n")
      .replace(/^\n+/, "")
      .trim();
  }
  return details;
}

function extractContactHints(text: string) {
  const email = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  const phoneMa = text.match(/(\+212|00212|0)[6-7]\d{8}/g);
  const phone = phoneMa?.[0] ?? text.match(/\+\d{10,15}/)?.[0];
  return { email: email?.[0], phone };
}

/** قائمة المؤسسة ونوع الوثيقة — فوق نص المحرر مباشرة لتحديث الفصول القانونية تلقائياً */
function LegalInstitutionControlsAboveEditor({
  form,
  setForm,
  t,
  locale,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  t: (key: string) => string;
  locale: string;
}) {
  const selectClass =
    "w-full min-h-[3rem] rounded-xl border-2 border-[#003876]/60 bg-[#0a1f3d] px-3 py-2.5 text-base text-white font-bold shadow-inner shadow-black/20 focus:outline-none focus:ring-4 focus:ring-[#003876]/35 transition-all duration-200";

  return (
    <div className="rounded-2xl border-2 border-[#003876]/60 bg-gradient-to-b from-[#0c2340]/98 via-[#082038] to-[#050a12] p-4 md:p-5 shadow-2xl shadow-[#003876]/20 ring-1 ring-[#c9a227]/35 mb-5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#003876]/40 border border-[#c9a227]/40">
          <Scale className="size-5 text-[#d4af37]" />
        </span>
        <div>
          <p className="text-white font-black text-sm md:text-base tracking-tight">
            {t("legalAi.section.legalEngine")}
          </p>
          <p className="text-[#93c5fd]/95 text-xs md:text-sm font-semibold leading-snug mt-1 max-w-3xl">
            {t("legalAi.legalContextAboveEditor")}
          </p>
        </div>
      </div>
      <p className="text-[10px] md:text-xs text-[#c9a227]/80 font-medium mb-4 border-b border-[#003876]/30 pb-3">
        {t("legalAi.varsNote")}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[#f5e6b8] font-black text-sm md:text-base flex items-center gap-1">
            {t("legalAi.field.institutionType")} <span className="text-[#d4af37]">*</span>
          </Label>
          <select
            value={form.institutionTypeId}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                institutionTypeId: e.target.value as MoroccanInstitutionType,
              }))
            }
            className={selectClass}
            aria-label={t("legalAi.field.institutionType")}
          >
            {INSTITUTION_OPTIONS.map((id) => (
              <option key={id} value={id} className="bg-[#0c1222] text-white">
                {moroccanInstitutionLabel(locale, id)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-[#f5e6b8] font-black text-sm md:text-base flex items-center gap-1">
            {t("legalAi.field.documentClass")} <span className="text-[#d4af37]">*</span>
          </Label>
          <select
            value={form.documentClassId}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                documentClassId: e.target.value as MoroccanDocumentClass,
              }))
            }
            className={selectClass}
            aria-label={t("legalAi.field.documentClass")}
          >
            {DOCUMENT_CLASS_OPTIONS.map((id) => (
              <option key={id} value={id} className="bg-[#0c1222] text-white">
                {moroccanDocumentClassLabel(locale, id)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/**
 * المحرر الإداري والقانوني: حفظ محلي (localStorage)، وتصدير PDF فوري A4 عبر html2canvas + jsPDF
 * (وثيقة الطلب + ترويسة المملكة المغربية والخط الأزرق). الطباعة الورقية اختيارية من ملف PDF.
 */
export function LegalEditor() {
  const { t, locale, isRtl } = useI18n();
  const { isApproved, approvedModules } = useAuth();
  const printSheetInnerRef = useRef<HTMLDivElement>(null);
  const printSheetRootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("scan");
  const [form, setForm] = useState<FormState>(() => loadFormState());
  const [adminPdfBusy, setAdminPdfBusy] = useState(false);
  /** تصدير PDF فوري: رسمي قانوني (افتراضي) أو طلب مبسّط بدون شعار/مقاطع قانونية */
  const [adminExportOfficialLegal, setAdminExportOfficialLegal] = useState(true);
  /** ترويسة المملكة في المعاينة وPDF — افتراضياً مفعّلة؛ إلغاؤها يخفي الشعار */
  const [officialKingdomHeader, setOfficialKingdomHeader] = useState(true);
  const [requestBodyManual, setRequestBodyManual] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const speech = useSpeechToText(locale);

  /** Open with today in the date field (ISO for &lt;input type="date" /&gt;; DMY Latin in `documentDateEnGb`). */
  useLayoutEffect(() => {
    setForm((f) => {
      if (f.documentDate?.trim()) return f;
      return { ...f, documentDate: todayIsoLocal() };
    });
  }, []);

  const appendRequestText = useCallback((text: string) => {
    const chunk = text.trim();
    if (!chunk) return;
    setRequestBodyManual(true);
    setForm((f) => ({
      ...f,
      requestDetails: f.requestDetails?.trim() ? `${f.requestDetails.trim()} ${chunk}` : chunk,
    }));
  }, []);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  const requestTypeLabel = useMemo(() => {
    const raw =
      form.requestTypeId === "custom_freeform"
        ? form.customRequestLabel.trim() || t("legalAi.type.custom_freeform")
        : t(`legalAi.type.${form.requestTypeId}`);
    return locale.startsWith("ar") ? arabicOfficialLine(raw) : raw;
  }, [form.requestTypeId, form.customRequestLabel, t, locale]);

  const serviceCenterLabel = useMemo(() => {
    const v = t(`legalAi.center.${form.serviceCenterId}`);
    return locale.startsWith("ar") ? arabicOfficialLine(v) : v;
  }, [form.serviceCenterId, t, locale]);

  /** dd/MM/yyyy Latin (e.g. 25/04/2026 only) */
  const documentDateDisplay = useMemo(
    () => formatLatinDateDMYFromIsoDate(form.documentDate),
    [form.documentDate]
  );

  /** en-GB + `numberingSystem: "latn"` (same effect as toLocaleDateString("en-GB", { numberingSystem: "latn" })). */
  const documentDateEnGb = useMemo(() => {
    const iso = form.documentDate?.trim() || todayIsoLocal();
    return formatEnGbShortDateLatin(new Date(`${iso}T12:00:00`));
  }, [form.documentDate]);

  const requestGroupId = useMemo(() => getRequestGroupIdForType(form.requestTypeId), [form.requestTypeId]);

  useEffect(() => {
    if (requestBodyManual) return;
    const dateFormatted = formatDocumentDate(form.documentDate, locale as AppLocale);
    const draft = buildLegalRequestDraft(locale as AppLocale, {
      formalRecipientLine: form.formalRecipientLine,
      requestGroupId,
      recipientEntity: form.recipientEntity,
      serviceCenterLabel,
      requestTypeLabel,
      fullName: form.fullName,
      nationalId: form.nationalId,
      address: form.address,
      phone: form.phone,
      email: form.email,
      documentDateIso: form.documentDate,
      dateFormatted,
      institutionTypeId: form.institutionTypeId,
      documentClassId: form.documentClassId,
    });
    setForm((f) => (f.requestDetails === draft ? f : { ...f, requestDetails: draft }));
  }, [
    requestBodyManual,
    form.formalRecipientLine,
    form.recipientEntity,
    form.documentDate,
    form.fullName,
    form.nationalId,
    form.address,
    form.phone,
    form.email,
    form.requestTypeId,
    form.customRequestLabel,
    locale,
    requestTypeLabel,
    serviceCenterLabel,
    requestGroupId,
    form.institutionTypeId,
    form.documentClassId,
  ]);

  const exportPayload: LegalExportPayload = useMemo(
    () => ({
      fullName: form.fullName,
      nationalId: form.nationalId,
      address: form.address,
      phone: form.phone,
      email: form.email,
      formalRecipientLine: form.formalRecipientLine,
      recipientEntity: form.recipientEntity,
      serviceCenterLabel,
      requestTypeLabel,
      documentDateDisplay,
      requestDetails: form.requestDetails,
      institutionTypeId: form.institutionTypeId,
      documentClassId: form.documentClassId,
    }),
    [form, serviceCenterLabel, requestTypeLabel, documentDateDisplay]
  );

  const applyOcr = useCallback(
    (text: string) => {
      const hints = parseMoroccanIdHints(text);
      const { email: emailFromText, phone: phoneFromText } = extractContactHints(text);
      setRequestBodyManual(false);
      setForm((f) => ({
        ...f,
        fullName: hints.fullName?.trim() || f.fullName,
        nationalId: hints.cin?.replace(/\s/g, "").toUpperCase() || f.nationalId,
        address: hints.address?.trim() || f.address,
        email: (emailFromText ?? hints.email)?.trim() || f.email,
        phone: (phoneFromText ?? hints.phone)?.replace(/\s/g, "") || f.phone,
      }));
      setOcrNote(t("legalAi.ocrApplied"));
      setTab("form");
    },
    [t]
  );

  const simulateNationalIdScan = useCallback(() => {
    applyOcr(SIMULATED_CNIE_OCR);
  }, [applyOcr]);

  const handleExportAdministrativePdf = useCallback(async () => {
    setAdminPdfBusy(true);
    try {
      const layoutSpacing = isAddressChangeRequestProfile(
        form.requestTypeId,
        requestTypeLabel,
        form.customRequestLabel.trim()
      )
        ? "address_change"
        : "default";
      await downloadLegalAdministrativeSheetPdf(
        {
          formalRecipientLine: form.formalRecipientLine.trim() || "—",
          requestBody:
            stripLeadingFormalLine(form.formalRecipientLine, form.requestDetails).trim() || "—",
          officialLegal: adminExportOfficialLegal,
          includeKingdomSeal: officialKingdomHeader,
          layoutSpacing,
          documentDateLine: documentDateDisplay || "—",
        },
        isRtl ? "rtl" : "ltr",
        locale,
        `legal-admin-${Date.now()}.pdf`
      );
    } catch {
      window.alert(t("legalAi.exportPdfInstantErr"));
    } finally {
      setAdminPdfBusy(false);
    }
  }, [
    t,
    form.formalRecipientLine,
    form.requestDetails,
    form.requestTypeId,
    form.customRequestLabel,
    isRtl,
    locale,
    adminExportOfficialLegal,
    officialKingdomHeader,
    documentDateDisplay,
    requestTypeLabel,
  ]);

  const legalModuleAllowed =
    isApproved &&
    (approvedModules.includes("legal_ai") ||
      approvedModules.includes("law") ||
      approvedModules.includes("public"));

  if (!legalModuleAllowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("edu.lockedTitle")}</h2>
        <p className="text-slate-400 text-sm">{t("edu.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div data-legal-editor-root className="relative">
      <div className="legal-editor-screen-only max-w-5xl space-y-8 pb-24 mx-auto">
      <header className="rounded-2xl border border-[#c9a227]/35 bg-gradient-to-br from-[#0a1628] via-[#0c2340] to-[#050a12] p-5 md:p-7 shadow-2xl shadow-[#003876]/20 backdrop-blur-sm transition-shadow duration-300 hover:shadow-[#003876]/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <MoroccoCrest />
            <div className="min-w-0 flex-1">
              <p className="text-[#d4af37] text-xs font-bold tracking-[0.2em] uppercase mb-1">
                المملكة المغربية
              </p>
              <div className="h-1 w-24 rounded-full bg-[#003876] mb-3 transition-all duration-500" />
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex flex-wrap items-start gap-x-2 gap-y-1">
                <Sparkles className="size-7 text-[#d4af37] shrink-0 animate-pulse mt-0.5" aria-hidden />
                <span className="min-w-0 flex-1 break-words leading-tight md:leading-snug">{t("legalAi.title")}</span>
              </h1>
              <p className="text-slate-300/90 mt-2 text-sm md:text-base font-medium max-w-2xl leading-relaxed break-words">
                {t("legalAi.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-[#003876]/50 ring-1 ring-[#c9a227]/20">
            <Scale className="size-7 text-[#d4af37]" strokeWidth={2} />
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1.5 bg-[#0a1628] border border-[#003876]/40 rounded-xl gap-1 shadow-inner">
          <TabsTrigger
            value="scan"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#003876] data-[state=active]:to-[#0c2340] data-[state=active]:text-white data-[state=active]:shadow-md font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 px-1 rounded-lg transition-all duration-300 text-slate-400 min-h-[3.25rem] whitespace-normal"
          >
            <ScanLine className="size-4 shrink-0" />
            <span className="text-[10px] sm:text-sm text-center leading-snug max-w-full break-words">
              {t("legalAi.tab.scan")}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="form"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#003876] data-[state=active]:to-[#0c2340] data-[state=active]:text-white data-[state=active]:shadow-md font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 px-1 rounded-lg transition-all duration-300 text-slate-400 min-h-[3.25rem] whitespace-normal"
          >
            <FileEdit className="size-4 shrink-0" />
            <span className="text-[10px] sm:text-sm text-center leading-snug max-w-full break-words">
              {t("legalAi.tab.form")}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#003876] data-[state=active]:to-[#0c2340] data-[state=active]:text-white data-[state=active]:shadow-md font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 px-1 rounded-lg transition-all duration-300 text-slate-400 min-h-[3.25rem] whitespace-normal"
          >
            <Send className="size-4 shrink-0" />
            <span className="text-[10px] sm:text-sm text-center leading-snug max-w-full break-words">
              {t("legalAi.tab.preview")}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="mt-6 space-y-4">
          <OcrScanner
            variant="royal"
            title={t("legalAi.scanTitle")}
            description={t("legalAi.scanHelp")}
            onExtracted={applyOcr}
            simulateLabel={t("legalAi.simulateCinScan")}
            onSimulateNationalId={simulateNationalIdScan}
          />
          {ocrNote && (
            <p className="text-sm font-bold text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-2 bg-emerald-500/10">
              {ocrNote}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="font-bold"
            onClick={() => {
              setOcrNote(null);
              setTab("form");
            }}
          >
            {t("legalAi.skipScan")}
          </Button>
        </TabsContent>

        <TabsContent value="form" className="mt-6 space-y-6">
          <SectionBar icon={FileEdit}>{t("legalAi.section.personal")}</SectionBar>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label={t("legalAi.field.fullName")}
              required
              value={form.fullName}
              onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
            />
            <Field
              label={t("legalAi.field.nationalId")}
              required
              value={form.nationalId}
              onChange={(v) => setForm((f) => ({ ...f, nationalId: v }))}
            />
            <div className="md:col-span-2">
              <Field
                label={t("legalAi.field.address")}
                required
                value={form.address}
                onChange={(v) => setForm((f) => ({ ...f, address: v }))}
              />
            </div>
            <Field
              label={t("legalAi.field.phone")}
              required
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <Field
              label={t("legalAi.field.email")}
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
          </div>

          <SectionBar icon={Send}>{t("legalAi.section.routing")}</SectionBar>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label className="text-white font-bold">{t("legalAi.field.formalRecipient")}</Label>
              <Input
                value={form.formalRecipientLine}
                onChange={(e) => setForm((f) => ({ ...f, formalRecipientLine: e.target.value }))}
                placeholder="مثال: إلى السيد وكيل الملك، — إلى السيد رئيس المقاطعة،"
                className="bg-[#0c1222] border-slate-700 font-medium text-white h-11"
              />
            </div>
            <Field
              label={t("legalAi.field.recipientEntity")}
              required
              value={form.recipientEntity}
              onChange={(v) => setForm((f) => ({ ...f, recipientEntity: v }))}
            />
            <div className="space-y-1.5 min-w-0">
              <Field
                label={t("legalAi.field.documentDate")}
                required
                type="date"
                value={form.documentDate}
                onChange={(v) => setForm((f) => ({ ...f, documentDate: v }))}
              />
              <p
                className="text-xs text-slate-400 font-semibold pl-0.5 tabular-nums break-all"
                dir="ltr"
                translate="no"
                lang="en-GB"
              >
                {documentDateEnGb}
              </p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-white font-bold flex items-center gap-1">
                {t("legalAi.field.serviceCenter")} <span className="text-[#FF8C00]">*</span>
              </Label>
              <select
                value={form.serviceCenterId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    serviceCenterId: e.target.value as LegalServiceCenterId,
                  }))
                }
                className="w-full h-11 rounded-lg border border-slate-700 bg-[#0c1222] px-3 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#003876]/50 transition-colors"
              >
                <optgroup label={t("legalAi.group.courts")}>
                  {LEGAL_COURT_CENTER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(`legalAi.center.${id}`)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("legalAi.group.administrations")}>
                  {LEGAL_ADMIN_CENTER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(`legalAi.center.${id}`)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("legalAi.group.otherRouting")}>
                  {LEGAL_OTHER_CENTER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(`legalAi.center.${id}`)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          <SectionBar icon={Sparkles}>{t("legalAi.section.details")}</SectionBar>
          <div className="space-y-2">
            <Label className="text-white font-bold flex items-center gap-1">
              {t("legalAi.field.requestType")} <span className="text-[#FF8C00]">*</span>
            </Label>
            <select
              value={form.requestTypeId}
              onChange={(e) => setForm((f) => ({ ...f, requestTypeId: e.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-700 bg-[#0c1222] px-3 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#003876]/50 transition-colors"
            >
              {LEGAL_REQUEST_GROUPS.map((g) => (
                <optgroup key={g.id} label={t(`legalAi.group.${g.id}`)}>
                  {g.typeIds.map((id) => (
                    <option key={id} value={id}>
                      {t(`legalAi.type.${id}`)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {form.requestTypeId === "custom_freeform" && (
            <Field
              label={t("legalAi.field.requestTypeCustom")}
              required
              value={form.customRequestLabel}
              onChange={(v) => setForm((f) => ({ ...f, customRequestLabel: v }))}
            />
          )}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-wrap">
              <Label className="text-white font-bold">{t("legalAi.field.requestBody")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="font-bold text-xs gap-2 border-fuchsia-500/40 text-fuchsia-100 hover:bg-fuchsia-950/40"
                  disabled={!speech.isSupported}
                  title={t("legalAi.speechPrivacy")}
                  onClick={() => {
                    if (speech.listening) speech.stop();
                    else speech.start(appendRequestText);
                  }}
                >
                  {speech.listening ? (
                    <MicOff className="size-4 text-fuchsia-300 animate-pulse" />
                  ) : (
                    <Mic className="size-4 text-cyan-300" />
                  )}
                  {speech.listening ? t("legalAi.speechStop") : t("legalAi.speechMic")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="font-bold text-xs shrink-0"
                  onClick={() => setRequestBodyManual(false)}
                >
                  {t("legalAi.regenerateDraft")}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">{t("legalAi.autoDraftHint")}</p>
            <p className="text-[10px] text-slate-600 leading-relaxed">{t("legalAi.speechPrivacy")}</p>
            <textarea
              value={form.requestDetails}
              onChange={(e) => {
                setRequestBodyManual(true);
                setForm((f) => ({ ...f, requestDetails: e.target.value }));
              }}
              rows={8}
              className="w-full rounded-lg border border-slate-700 bg-[#0c1222] px-3 py-2 text-sm text-white font-medium placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/50 min-h-[160px]"
              placeholder={t("legalAi.requestPlaceholder")}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="secondary"
              className="font-black gap-2 w-full sm:w-auto"
              onClick={handleSave}
            >
              <Save className="size-4" />
              {t("common.save")}
            </Button>
            <Button
              type="button"
              className="font-black bg-gradient-to-r from-[#003876] to-[#0c2340] hover:opacity-95 flex-1 border border-[#c9a227]/30 shadow-lg shadow-[#003876]/25 transition-all duration-300"
              onClick={() => setTab("preview")}
            >
              {t("legalAi.goPreview")}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-6 space-y-6">
          <Card className="border-[#003876]/40 bg-gradient-to-b from-[#0a1628]/95 to-[#050a12] shadow-xl shadow-black/40">
            <CardHeader className="border-b border-[#003876]/30 bg-gradient-to-r from-[#003876]/25 to-[#0c2340]/40">
              <p className="text-lg font-black text-white">{t("legalAi.previewTitle")}</p>
              <p className="text-xs text-[#c9a227]/90 font-medium mt-1">{t("legalAi.disclaimer")}</p>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-sm">
              <PreviewRow label={t("legalAi.field.fullName")} value={form.fullName} />
              <PreviewRow label={t("legalAi.field.nationalId")} value={form.nationalId} />
              <PreviewRow label={t("legalAi.field.address")} value={form.address} />
              <PreviewRow label={t("legalAi.field.phone")} value={form.phone} />
              <PreviewRow label={t("legalAi.field.email")} value={form.email} />
              <PreviewRow label={t("legalAi.field.formalRecipient")} value={form.formalRecipientLine} />
              <PreviewRow label={t("legalAi.field.recipientEntity")} value={form.recipientEntity} />
              <PreviewRow label={t("legalAi.field.serviceCenter")} value={serviceCenterLabel} />
              <PreviewRow label={t("legalAi.field.documentDate")} value={documentDateDisplay} />
              <PreviewRow label={t("legalAi.field.requestType")} value={requestTypeLabel} />
              <LegalInstitutionControlsAboveEditor form={form} setForm={setForm} t={t} locale={locale} />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-slate-500 font-bold text-xs uppercase">{t("legalAi.field.requestBody")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-cyan-500/35 text-cyan-100"
                    disabled={!speech.isSupported}
                    onClick={() => {
                      if (speech.listening) speech.stop();
                      else speech.start(appendRequestText);
                    }}
                  >
                    {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                    {t("legalAi.speechMic")}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{t("legalAi.previewEditHint")}</p>
                <textarea
                  value={form.requestDetails}
                  onChange={(e) => {
                    setRequestBodyManual(true);
                    setForm((f) => ({ ...f, requestDetails: e.target.value }));
                  }}
                  rows={14}
                  className="w-full rounded-lg border border-slate-700 bg-[#0c1222] px-3 py-2 text-sm text-slate-100 font-medium placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#003876]/50 min-h-[220px] transition-shadow"
                  placeholder={t("legalAi.requestPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
          <div className="rounded-xl border border-[#003876]/40 bg-[#0a1628]/80 p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-200">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-slate-600 accent-[#003876]"
                checked={officialKingdomHeader}
                onChange={(e) => setOfficialKingdomHeader(e.target.checked)}
              />
              <span>
                <span className="font-bold text-white block">{t("legalAi.officialKingdomToggle")}</span>
                <span className="text-slate-400 text-xs leading-relaxed">{t("legalAi.officialKingdomHint")}</span>
              </span>
            </label>
          </div>
          <div className="rounded-xl border border-[#0052CC]/30 bg-[#0a1628]/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
            <p className="text-sm font-bold text-slate-100 min-w-0 break-words leading-snug shrink">
              {t("legalAi.pdfExportModeLabel")}
            </p>
            <div
              className="inline-flex flex-wrap sm:flex-nowrap rounded-lg border border-slate-600 bg-[#050a12] p-0.5 gap-0.5 shrink-0"
              role="group"
              aria-label={t("legalAi.pdfExportModeLabel")}
            >
              <button
                type="button"
                className={`rounded-md px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all leading-snug text-center whitespace-normal ${
                  adminExportOfficialLegal
                    ? "bg-gradient-to-r from-[#0052CC] via-[#0066ff] to-[#1d4ed8] text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setAdminExportOfficialLegal(true)}
              >
                {t("legalAi.pdfModeOfficial")}
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs font-black transition-all leading-snug text-center whitespace-normal ${
                  !adminExportOfficialLegal
                    ? "bg-gradient-to-r from-[#0052CC] via-[#0066ff] to-[#1d4ed8] text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setAdminExportOfficialLegal(false)}
              >
                {t("legalAi.pdfModeSimple")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              type="button"
              variant="secondary"
              className="font-black gap-2 border border-[#c9a227]/25 min-h-[2.875rem] whitespace-normal text-center leading-snug px-3"
              onClick={handleSave}
            >
              <Save className="size-4 shrink-0" />
              {t("common.save")}
            </Button>
            <Button
              type="button"
              disabled={adminPdfBusy}
              onClick={() => void handleExportAdministrativePdf()}
              className="font-black gap-2 bg-gradient-to-r from-[#0052CC] via-[#0066ff] to-[#1d4ed8] hover:opacity-92 text-white border border-cyan-400/25 shadow-lg shadow-[#0052CC]/25 min-h-[2.875rem] whitespace-normal text-center leading-snug px-3"
            >
              <FileType2 className="size-4 shrink-0" aria-hidden />
              {adminPdfBusy ? t("legalAi.exporting") : t("legalAi.downloadPdf")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="font-black gap-2 border-[#c9a227]/40 text-[#f5e6b8] hover:bg-[#003876]/30"
              onClick={() =>
                void openLegalDocumentOfficialPdf(exportPayload, isRtl ? "rtl" : "ltr", locale)
              }
            >
              <Download className="size-4" />
              {t("legalAi.exportPdfOfficial")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="font-black gap-2 border-[#c9a227]/40 text-white hover:bg-[#0c2340]"
              onClick={() => downloadLegalDocumentXlsx(`legal-doc-${Date.now()}.xlsx`, exportPayload)}
            >
              <FileSpreadsheet className="size-4" />
              {t("legalAi.downloadXlsx")}
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              className="font-black gap-2 flex-1 bg-gradient-to-r from-[#0c2340] to-[#003876] border border-[#c9a227]/35"
              onClick={() => void downloadLegalDocumentDocx(`legal-doc-${Date.now()}.docx`, exportPayload)}
            >
              <FileText className="size-4" />
              {t("legalAi.downloadWord")}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <Link
        to="/app/chat"
        className="fixed bottom-6 end-6 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#003876] to-[#0c2340] text-white shadow-xl shadow-[#003876]/40 hover:scale-105 transition-transform border border-[#c9a227]/30 print:hidden"
        title={t("legalAi.fabChat")}
      >
        <MessageCircle className="size-7" />
      </Link>
      </div>

      <div
        className="legal-print-sheet-only"
        aria-hidden="true"
        data-legal-print-sheet
        ref={printSheetRootRef}
      >
        <div className="legal-print-sheet-inner" ref={printSheetInnerRef}>
          {officialKingdomHeader ? (
            <div className="legal-print-kingdom-row">
              <div className="legal-print-kingdom" role="presentation">
                المملكة المغربية
              </div>
              <div className="legal-print-royal-line" aria-hidden="true" />
            </div>
          ) : (
            <div className="legal-print-pro-divider" aria-hidden="true" />
          )}
          <div className="legal-print-formal">{form.formalRecipientLine.trim() || "—"}</div>
          <div className="legal-print-body-main">
            {stripLeadingFormalLine(form.formalRecipientLine, form.requestDetails).trim() || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function MoroccoCrest() {
  return (
    <div
      className="relative shrink-0 size-16 rounded-2xl overflow-hidden border-2 border-[#c9a227]/40 shadow-lg shadow-[#003876]/30 ring-2 ring-[#003876]/20 transition-transform duration-300 hover:scale-[1.02]"
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="size-full" role="img">
        <title>المملكة المغربية</title>
        <rect width="64" height="64" fill="#C1272D" />
        <path
          fill="#006233"
          d="M32 10 L35.5 22.5 H48 L38 30.5 L41.5 43 L32 35 L22.5 43 L26 30.5 L16 22.5 H28.5 Z"
        />
      </svg>
    </div>
  );
}

function SectionBar({ children, icon: Icon }: { children: ReactNode; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#003876]/90 via-[#0c2340] to-[#0a1628] px-4 py-3 border border-[#c9a227]/35 shadow-md transition-all duration-300 hover:border-[#d4af37]/50">
      <Icon className="size-5 text-[#d4af37] shrink-0" />
      <span className="font-black text-white text-sm md:text-base">{children}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white font-bold flex items-center gap-1">
        {label}
        {required && <span className="text-[#FF8C00]">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#0c1222] border-slate-700 font-medium text-white h-11"
        {...(type === "date" || type === "time" || type === "datetime-local"
          ? { lang: "en", dir: "ltr" }
          : {})}
      />
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  const show = toWesternDigits(value || "—");
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-slate-800/80 pb-2">
      <span className="text-slate-500 font-bold text-xs uppercase shrink-0">{label}</span>
      <span className="text-white font-semibold text-end sm:text-start break-words tabular-nums">{show}</span>
    </div>
  );
}
