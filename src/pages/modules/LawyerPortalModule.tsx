import { useState } from "react";
import {
  Download,
  FileText,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { todayIsoLocal } from "@/lib/todayIso";
import { downloadPdfFromFullHtmlDocument } from "@/lib/pdfCanvasExport";
import { toWesternDigits } from "@/lib/unicodeDigits";

// ─── Types ────────────────────────────────────────────────────────────────────

type CaseType =
  | "civil"
  | "commercial"
  | "family"
  | "administrative"
  | "criminal"
  | "labor"
  | "real_estate"
  | "other";

type CourtType = "الابتدائية" | "التجارية" | "الإدارية" | "الاستئناف";
type LawyerLevel = "المجلس الأعلى" | "محكمة الاستئناف" | "المحكمة الابتدائية";

interface FormState {
  // Lawyer
  lawyerName: string;
  lawyerLevel: LawyerLevel;
  lawyerAddress: string;
  lawyerPhone: string;
  courtCity: string;
  // Client
  clientName: string;
  clientAddress: string;
  clientId: string;
  // Opposite
  oppositeName: string;
  oppositeAddress: string;
  // Case
  caseType: CaseType;
  courtType: CourtType;
  mainRequest: string;
  caseNumber: string;
  filingDate: string;
  // AI inputs
  briefDescription: string;
  // Generated sections
  facts: string;
  legalGrounds: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months: Record<string, string> = {
    "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
    "05": "ماي", "06": "يونيو", "07": "يوليوز", "08": "غشت",
    "09": "شتنبر", "10": "أكتوبر", "11": "نونبر", "12": "دجنبر",
  };
  return `${toWesternDigits(d)} ${months[m] ?? m} ${toWesternDigits(y)}`;
}

// ─── Legal basis by case type ─────────────────────────────────────────────────

const CASE_LABELS_AR: Record<CaseType, string> = {
  civil: "التعويض عن الضرر المدني",
  commercial: "النزاع التجاري",
  family: "شؤون الأسرة",
  administrative: "الإلغاء لتجاوز السلطة",
  criminal: "النزاع الجنائي",
  labor: "النزاع الشغلي",
  real_estate: "النزاع العقاري",
  other: "دعوى مدنية",
};

interface LegalBasisEntry {
  articles: string[];
  groundsText: string;
}

const LEGAL_BASIS_BY_TYPE: Record<CaseType, LegalBasisEntry> = {
  civil: {
    articles: [
      "الفصل 77 من قانون الالتزامات والعقود",
      "الفصل 78 من قانون الالتزامات والعقود",
      "الفصل 264 من قانون الالتزامات والعقود المتعلق بالتعويض",
      "الفصل 32 من قانون المسطرة المدنية",
    ],
    groundsText:
      "وحيث إن المسؤولية المدنية للمدعى عليه ثابتة بموجب أحكام الفصل 77 من ق.ل.ع الذي ينص على أن كل فعل يسبب ضرراً للغير يلزم من ارتكبه بالتعويض عنه.\n\nوحيث إن الضرر المُلحَق بالطالب موثق ومثبت بالوثائق المدلى بها، وأن رابطة السببية بين خطأ المدعى عليه والضرر اللاحق بالطالب ثابتة لا ريب فيها.\n\nوحيث إن الفصل 264 من ق.ل.ع يوجب التعويض الكامل عن الأضرار المادية والمعنوية الناجمة عن الخطأ الثابت.",
  },
  commercial: {
    articles: [
      "المادة 6 من مدونة التجارة",
      "المادة 49 من مدونة التجارة",
      "الفصل 231 من قانون الالتزامات والعقود المتعلق بالالتزامات التعاقدية",
      "الفصل 32 من قانون المسطرة المدنية",
    ],
    groundsText:
      "وحيث إن العلاقة التجارية الجامعة بين الطرفين ثابتة بالعقد والمراسلات التجارية المدلى بها.\n\nوحيث إن المدعى عليه قد أخل بالتزاماته التعاقدية المنصوص عليها في المادة 49 من مدونة التجارة، مما أفضى إلى أضرار جسيمة لموكلنا.\n\nوحيث إن مقتضيات الفصل 231 من ق.ل.ع تُوجب الوفاء بالالتزامات التعاقدية وفق ما تم الاتفاق عليه، وأن الإخلال بها يستوجب التعويض.",
  },
  family: {
    articles: [
      "المادة 51 من مدونة الأسرة",
      "المادة 115 من مدونة الأسرة",
      "المادة 164 من مدونة الأسرة المتعلقة بالنفقة",
      "الفصل 32 من قانون المسطرة المدنية",
    ],
    groundsText:
      "وحيث إن أحكام مدونة الأسرة الصادرة بتنفيذها الظهير الشريف رقم 1.04.22 تُلزم بصون الحقوق الأسرية وحمايتها قضائياً.\n\nوحيث إن المادة 51 من مدونة الأسرة تنص على الحقوق والواجبات المتبادلة بين الزوجين وأن أي إخلال بها يستوجب التدخل القضائي.\n\nوحيث إن مصلحة الأسرة ومبدأ الحفاظ على الروابط العائلية يستوجبان على المحكمة الموقرة الإحاطة بهذه النازلة والبت فيها وفق أحكام الشريعة الإسلامية السمحاء.",
  },
  administrative: {
    articles: [
      "الفصل 8 من القانون رقم 90-41 المحدث للمحاكم الإدارية",
      "الفصل 14 من القانون رقم 90-41 المتعلق بالإلغاء",
      "الفصل 111 من الدستور المغربي المتعلق بحق التقاضي",
      "الفصل 32 من قانون المسطرة المدنية",
    ],
    groundsText:
      "وحيث إن القرار الإداري المطعون فيه يفتقر إلى الأساس القانوني السليم ويشكل تجاوزاً صريحاً لحدود السلطة التقديرية الممنوحة للإدارة.\n\nوحيث إن مبدأ المشروعية الذي يحكم نشاط الإدارة يقتضي إخضاع قراراتها لرقابة القضاء الإداري المختص وفق أحكام القانون رقم 90-41.\n\nوحيث إن الفصل 111 من الدستور يكفل لكل مواطن حق التقاضي وأن القضاء الإداري هو الجهة المختصة للنظر في مشروعية القرارات الإدارية.",
  },
  criminal: {
    articles: [
      "الفصل 7 من قانون المسطرة الجنائية",
      "الفصل 42 من قانون المسطرة الجنائية",
      "الفصول 1 إلى 10 من القانون الجنائي",
      "الفصل 23 من الدستور المتعلق بقرينة البراءة",
    ],
    groundsText:
      "وحيث إن الأفعال المنسوبة تشكل جريمة يعاقب عليها القانون الجنائي المغربي وفق الفصول المشار إليها أعلاه.\n\nوحيث إن عناصر الجريمة من ركن مادي وركن معنوي ثابتة بصريح الوثائق والمستندات المدلى بها.\n\nوحيث إن مبدأ العدالة ومقتضيات الردع العام والخاص تستوجب توقيع العقوبة المقررة قانوناً على مرتكب الجريمة.",
  },
  labor: {
    articles: [
      "المادة 356 من مدونة الشغل المتعلقة بالفصل التعسفي",
      "المادة 41 من مدونة الشغل",
      "المادة 510 من مدونة الشغل المتعلقة بالمنازعات",
      "الفصل 32 من قانون المسطرة المدنية",
    ],
    groundsText:
      "وحيث إن علاقة الشغل الجامعة بين الطرفين ثابتة بعقد الشغل وشهادات التوظيف المدلى بها.\n\nوحيث إن المادة 356 من مدونة الشغل تُعرّف الفصل التعسفي بأنه كل فصل لا يستند إلى سبب مشروع وحقيقي، وأن ما تعرض له موكلنا لا يستوفي شروط الفصل القانوني السليم.\n\nوحيث إن موكلنا يستحق التعويض الكامل عن الضرر اللاحق به جراء الفصل التعسفي وفق ما تنص عليه أحكام مدونة الشغل.",
  },
  real_estate: {
    articles: [
      "الفصل 64 من ظهير التحفيظ العقاري",
      "الفصل 569 من قانون الالتزامات والعقود المتعلق بالبيع",
      "الفصل 32 من قانون المسطرة المدنية",
      "القانون رقم 07-44 المتعلق بالمسطرة الجنائية في مجال التحفيظ",
    ],
    groundsText:
      "وحيث إن الحق العيني محل النزاع ثابت بالرسم العقاري والوثائق الإثباتية المدلى بها.\n\nوحيث إن أحكام ظهير التحفيظ العقاري تُقرر حرمة الحق العقاري المحفظ وتكفل صاحبه الحماية القضائية الكاملة.\n\nوحيث إن موكلنا قد استنفد السبل الودية دون جدوى، مما يجعل اللجوء إلى القضاء العقاري أمراً لا مناص منه لصون حقه الثابت.",
  },
  other: {
    articles: [
      "الفصل 1 من قانون الالتزامات والعقود",
      "الفصل 32 من قانون المسطرة المدنية",
      "المبادئ العامة للقانون المعترف بها في التشريع المغربي",
    ],
    groundsText:
      "وحيث إن الحق المطالب به ثابت بالوثائق المدلى بها والمستندات الإثباتية المقدمة بملف النازلة.\n\nوحيث إن مبادئ العدالة والإنصاف المعترف بها في التشريع المغربي توجب على هذه المحكمة الموقرة الإحاطة بجميع جوانب هذه النازلة والبت فيها وفق ما يقتضيه القانون.\n\nوحيث إن موكلنا قد لجأ إلى القضاء بعد أن استنفد كافة السبل الودية، ويلتمس من عدالة المحكمة إنصافه واسترداد حقه.",
  },
};

// ─── AI Draft Generator ───────────────────────────────────────────────────────

function generateFacts(f: FormState): string {
  const caseLabel = CASE_LABELS_AR[f.caseType];
  const description = f.briefDescription.trim();

  return `يتشرف العارض بأن ينهي إلى كريم علمكم ما يلي:

أولاً: الأطراف والإطار العام
——————————————————
• الطالب: السيد/السيدة ${f.clientName}، الساكن بـ ${f.clientAddress || "العنوان المذكور بالملف"}${f.clientId ? `، الحامل لبطاقة التعريف الوطنية رقم ${toWesternDigits(f.clientId)}` : ""}.
• المدعى عليه: السيد/السيدة ${f.oppositeName}، الساكن بـ ${f.oppositeAddress || "العنوان المذكور بالملف"}.
• موضوع الدعوى: ${caseLabel}${f.caseNumber ? `  —  رقم الملف: ${toWesternDigits(f.caseNumber)}` : ""}.

ثانياً: سرد الوقائع
——————————————————
${description
  ? description
  : `تقدّم موكلنا المذكور بصفته طرفاً متضرراً بسبب تصرفات الطرف المقابل التي ألحقت به أضراراً جسيمة موثقة ومثبتة.`}

وبما أن الوقائع المُحتجّ بها أمام عدالتكم تستوجب التدخل القضائي العاجل لإيقاف الضرر المتواصل وإنصاف الطالب، فإن موكلنا يلتجئ إلى القضاء المغربي المحترم بكل ثقة واحترام.`;
}

function generateLegalGrounds(f: FormState): string {
  const basis = LEGAL_BASIS_BY_TYPE[f.caseType];
  const articlesBlock = basis.articles
    .map((a, i) => `${toWesternDigits(String(i + 1))}. ${a}`)
    .join("\n");

  return `بناء على فصول المسطرة المدنية وما يلي من أسانيد قانونية:

${articlesBlock}

——————————————————
${basis.groundsText}

وحيث إن جميع شروط القبول والأهلية والمصلحة والصفة متوفرة في دعوى موكلنا.

وحيث إن هذه المحكمة الموقرة مختصة ترابياً ونوعياً للنظر في هذه النازلة.

وحيث إن الوثائق والمستندات المدلى بها تُثبت الحق المُطالَب به إثباتاً قاطعاً لا يقبل الطعن.`;
}

// ─── PDF HTML Builder ─────────────────────────────────────────────────────────

function buildCourtFilingHtml(f: FormState): string {
  const todayDisplay = formatDisplayDate(f.filingDate || todayIsoLocal());
  const caseLabel = CASE_LABELS_AR[f.caseType];
  const caseNum = f.caseNumber ? toWesternDigits(f.caseNumber) : "—";

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");

  const factsHtml = esc(f.facts || generateFacts(f));
  const groundsHtml = esc(f.legalGrounds || generateLegalGrounds(f));
  const mainReq = esc(f.mainRequest || "الحكم للطالب بجميع طلباته");
  const clientId = f.clientId ? toWesternDigits(f.clientId) : "";

  return `<!DOCTYPE html>
<html lang="ar-MA" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 20mm 15mm 20mm 15mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Noto Naskh Arabic", "Traditional Arabic", Arial, serif;
    font-size: 12pt;
    line-height: 1.85;
    color: #111;
    background: #fff;
    direction: rtl;
    padding: 28px 36px;
    max-width: 210mm;
    margin: 0 auto;
  }

  /* ── outer frame ── */
  .outer-frame {
    border: 3px double #003876;
    padding: 0;
    position: relative;
  }
  .inner-pad { padding: 26px 34px 30px; }

  /* ── kingdom header ── */
  .header-block {
    text-align: center;
    border-bottom: 2px solid #003876;
    padding-bottom: 14px;
    margin-bottom: 0;
  }
  .header-title {
    font-size: 17pt;
    font-weight: 700;
    text-decoration: underline;
    line-height: 1.6;
    color: #003876;
  }

  /* ── meta row: lawyer info LEFT, date RIGHT (visual RTL: swap) ── */
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 18px;
    gap: 10px;
  }
  .lawyer-info { font-size: 11pt; line-height: 1.75; }
  .lawyer-info strong { color: #003876; }
  .date-block {
    text-align: left;
    font-size: 11pt;
    white-space: nowrap;
    padding-top: 2px;
    font-weight: 600;
    color: #222;
  }

  /* ── salutation ── */
  .salutation {
    text-align: center;
    margin-top: 22px;
    font-size: 14pt;
    font-weight: 700;
    color: #003876;
    border-top: 1.5px solid #c9a227;
    border-bottom: 1.5px solid #c9a227;
    padding: 8px 0;
  }

  /* ── parties block ── */
  .parties { margin-top: 20px; font-size: 11.5pt; line-height: 2; }
  .parties strong { color: #003876; }

  /* ── subject banner ── */
  .subject-banner {
    text-align: center;
    margin-top: 20px;
    font-size: 13pt;
    font-weight: 700;
    background: #f2f2f2;
    border: 1px solid #ccc;
    padding: 8px 12px;
    color: #111;
  }

  /* ── section heading ── */
  .sec-heading {
    font-size: 12pt;
    font-weight: 700;
    color: #003876;
    margin-top: 22px;
    margin-bottom: 6px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* ── body text ── */
  .body-text {
    font-size: 11.5pt;
    line-height: 2;
    text-align: justify;
    color: #111;
    margin-bottom: 4px;
  }
  .body-text p { margin-bottom: 6px; }
  .body-text strong { color: #003876; }

  /* ── requests list ── */
  .requests { margin-top: 20px; font-size: 11.5pt; line-height: 2; }
  .requests strong { text-decoration: underline; color: #003876; }
  .requests ol { padding-right: 20px; margin-top: 8px; }
  .requests li { margin-bottom: 4px; }

  /* ── signature ── */
  .sig-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 40px;
  }
  .sig-left { text-align: left; font-size: 10.5pt; color: #444; }
  .sig-right { text-align: right; font-size: 11pt; }
  .sig-right strong { font-size: 12pt; color: #003876; }
  .sig-stamp {
    border: 1.5px dashed #003876;
    border-radius: 50%;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 7.5pt;
    color: #003876;
    text-align: center;
    margin-top: 6px;
  }

  /* ── footer ── */
  .footer {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #ccc;
    text-align: center;
    font-size: 8pt;
    color: #888;
  }

  .gold-rule { border: none; border-top: 1.5px solid #c9a227; margin: 10px 0; }
</style>
</head>
<body>
<div class="outer-frame">
<div class="inner-pad">

  <!-- Kingdom Header -->
  <div class="header-block">
    <div class="header-title">
      المملكة المغربية<br/>
      وزارة العدل والحريات<br/>
      هيئة المحامين بـ ${esc(f.courtCity || "الرباط")}
    </div>
  </div>

  <!-- Lawyer info + Date row -->
  <div class="meta-row">
    <div class="lawyer-info">
      <strong>الأستاذ:</strong> ${esc(f.lawyerName)}<br/>
      <strong>محامٍ لدى ${esc(f.lawyerLevel)}</strong><br/>
      <strong>العنوان:</strong> ${esc(f.lawyerAddress)}${f.lawyerPhone ? `<br/><strong>الهاتف:</strong> <span dir="ltr" style="unicode-bidi:embed">${esc(toWesternDigits(f.lawyerPhone))}</span>` : ""}
    </div>
    <div class="date-block">
      ${esc(f.courtCity || "طنجة")} في: <strong>${esc(todayDisplay)}</strong>
    </div>
  </div>

  <hr class="gold-rule"/>

  <!-- Salutation -->
  <div class="salutation">
    إلى السيد رئيس المحكمة ${esc(f.courtType)} بـ ${esc(f.courtCity || "الرباط")}
  </div>

  <!-- Parties -->
  <div class="parties">
    <strong>لفائدة:</strong> السيد/السيدة ${esc(f.clientName)}، الساكن بـ ${esc(f.clientAddress || "—")}${clientId ? `، الحامل لبطاقة التعريف الوطنية رقم <strong>${esc(clientId)}</strong>` : ""}.<br/>
    <strong>نائبه:</strong> الأستاذ ${esc(f.lawyerName)}.<br/><br/>
    <strong>ضد:</strong> السيد/السيدة ${esc(f.oppositeName)}، الساكن بـ ${esc(f.oppositeAddress || "—")}.
  </div>

  <!-- Subject -->
  <div class="subject-banner">
    الموضوع: مقال افتتاحي من أجل ${esc(caseLabel)}
    ${f.caseNumber ? `&nbsp;—&nbsp; رقم الملف: ${esc(caseNum)}` : ""}
  </div>

  <!-- Facts -->
  <div class="sec-heading">أولاً: الوقائع</div>
  <div class="body-text"><p>${factsHtml}</p></div>

  <!-- Legal Grounds -->
  <div class="sec-heading">ثانياً: الحيثيات والأسانيد القانونية</div>
  <div class="body-text"><p>${groundsHtml}</p></div>

  <!-- Requests -->
  <div class="requests">
    <strong>لأجله، نلتمس من جنابكم بكل احترام:</strong>
    <ol>
      <li>قبول المقال شكلاً لاستيفائه كافة الشروط القانونية المقررة.</li>
      <li>في الموضوع: الحكم بـ ${mainReq}.</li>
      <li>تحميل المدعى عليه الصائر والنفاذ المعجل رغم كل طعن.</li>
    </ol>
    <br/>
    <em>وإننا نلتمس من عدالة المحكمة الموقرة إنصاف موكلنا واسترداد حقه المشروع، والله ولي التوفيق.</em>
  </div>

  <!-- Signature -->
  <div class="sig-row">
    <div class="sig-left">
      المكتب: ${esc(f.lawyerAddress || "—")}<br/>
      التاريخ: ${esc(todayDisplay)}
    </div>
    <div class="sig-right">
      <strong>توقيع وختم المحامي:</strong><br/>
      <div class="sig-stamp">الختم<br/>والتوقيع</div>
      <div style="margin-top:6px;font-size:10pt">الأستاذ ${esc(f.lawyerName)}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    وثيقة قانونية احترافية — الأرقام لاتينية (123) — هيئة المحامين بـ ${esc(f.courtCity || "الرباط")} — المملكة المغربية
  </div>

</div><!-- /inner-pad -->
</div><!-- /outer-frame -->
</body>
</html>`;
}

// ─── Form initial state ───────────────────────────────────────────────────────

const DEFAULT_FORM: FormState = {
  lawyerName: "",
  lawyerLevel: "المجلس الأعلى",
  lawyerAddress: "",
  lawyerPhone: "",
  courtCity: "طنجة",
  clientName: "",
  clientAddress: "",
  clientId: "",
  oppositeName: "",
  oppositeAddress: "",
  caseType: "civil",
  courtType: "الابتدائية",
  mainRequest: "",
  caseNumber: "",
  filingDate: todayIsoLocal(),
  briefDescription: "",
  facts: "",
  legalGrounds: "",
};

// ─── Constants for selects ────────────────────────────────────────────────────

const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: "civil", label: "مدني — التعويض عن الضرر" },
  { value: "commercial", label: "تجاري — نزاع تجاري" },
  { value: "family", label: "أسري — شؤون الأسرة" },
  { value: "administrative", label: "إداري — إلغاء لتجاوز السلطة" },
  { value: "criminal", label: "جنائي" },
  { value: "labor", label: "اجتماعي — نزاع شغلي" },
  { value: "real_estate", label: "عقاري" },
  { value: "other", label: "أخرى" },
];

const COURT_TYPES: CourtType[] = ["الابتدائية", "التجارية", "الإدارية", "الاستئناف"];
const LAWYER_LEVELS: LawyerLevel[] = ["المجلس الأعلى", "محكمة الاستئناف", "المحكمة الابتدائية"];
const MOROCCAN_CITIES = [
  "طنجة", "الرباط", "الدار البيضاء", "فاس", "مراكش", "أكادير",
  "مكناس", "وجدة", "القنيطرة", "تطوان", "الجديدة", "بني ملال",
  "خريبكة", "الحسيمة", "الناظور", "سطات",
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function LawyerPortalModule() {
  const { isApproved, approvedModules } = useAuth();
  const { t, isRtl } = useI18n();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "draft" | "preview">("form");

  const allowed =
    isApproved &&
    (approvedModules.includes("lawyer") ||
      approvedModules.includes("law") ||
      approvedModules.includes("legal_ai"));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const generateDraft = () => {
    setGenerating(true);
    setTimeout(() => {
      setForm((p) => ({
        ...p,
        facts: generateFacts(p),
        legalGrounds: generateLegalGrounds(p),
      }));
      setGenerating(false);
      setActiveTab("draft");
    }, 800);
  };

  const handlePreview = () => {
    setPreviewHtml(buildCourtFilingHtml(form));
    setActiveTab("preview");
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const html = buildCourtFilingHtml(form);
      const nameSlug = (form.clientName || "client").replace(/\s+/g, "-").slice(0, 20);
      await downloadPdfFromFullHtmlDocument(html, {
        fileName: `مقال-قضائي-${nameSlug}-${toWesternDigits(form.filingDate || todayIsoLocal())}.pdf`,
        scale: 2,
        iframeFontWaitMs: 1400,
        preCaptureDelayMs: 400,
      });
    } finally {
      setExporting(false);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/15 p-10 text-center space-y-4 max-w-xl mx-auto mt-10">
        <Scale className="size-12 text-amber-400 mx-auto" />
        <p className="text-white font-bold text-lg">{t("lawyer.lockedTitle")}</p>
        <p className="text-slate-400 text-sm">{t("lawyer.lockedDesc")}</p>
      </div>
    );
  }

  const tabCls = (tab: typeof activeTab) =>
    `px-5 py-2 rounded-t-xl text-sm font-bold transition-colors border-b-2 ${
      activeTab === tab
        ? "bg-[#003876] text-white border-[#c9a227]"
        : "bg-black/20 text-slate-400 border-transparent hover:text-white"
    }`;

  const formReady = !!form.lawyerName && !!form.clientName && !!form.oppositeName;

  return (
    <div className="space-y-6 max-w-5xl pb-16" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#003876] p-2.5 shadow-lg">
            <Gavel className="size-7 text-[#c9a227]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{t("lawyer.title")}</h1>
            <p className="text-sm text-slate-400">{t("lawyer.subtitle")}</p>
          </div>
        </div>
        <div className="flex-1" />
        {(form.facts || form.legalGrounds) && (
          <Button
            type="button"
            disabled={exporting}
            className="gap-2 bg-[#003876] hover:bg-[#004a99] text-white font-bold shadow"
            onClick={() => void exportPdf()}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t("lawyer.exportPdf")}
          </Button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-white/10">
        <button type="button" className={tabCls("form")} onClick={() => setActiveTab("form")}>
          <span className="flex items-center gap-1.5"><FileText className="size-4" />{t("lawyer.tabForm")}</span>
        </button>
        <button type="button" className={tabCls("draft")} onClick={() => setActiveTab("draft")}>
          <span className="flex items-center gap-1.5"><Sparkles className="size-4" />{t("lawyer.tabDraft")}</span>
        </button>
        <button type="button" className={tabCls("preview")} onClick={handlePreview}>
          <span className="flex items-center gap-1.5"><Scale className="size-4" />{t("lawyer.tabPreview")}</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: FORM
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "form" && (
        <div className="space-y-6">

          {/* Lawyer identity */}
          <section className="rounded-2xl border border-[#003876]/60 bg-gradient-to-br from-[#003876]/20 to-black/20 p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#c9a227] uppercase tracking-wider flex items-center gap-2">
              <Gavel className="size-4" /> {t("lawyer.sectionLawyer")}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Label className="text-slate-300 text-xs">{t("lawyer.lawyerName")} *</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.lawyerName}
                  onChange={(e) => set("lawyerName", e.target.value)}
                  placeholder={t("lawyer.lawyerNamePlaceholder")}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.barNumber")}</Label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  value={form.lawyerLevel}
                  onChange={(e) => set("lawyerLevel", e.target.value as LawyerLevel)}
                >
                  {LAWYER_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-slate-300 text-xs">{t("lawyer.lawyerAddress")}</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.lawyerAddress}
                  onChange={(e) => set("lawyerAddress", e.target.value)}
                  placeholder={t("lawyer.lawyerAddressPlaceholder")}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.lawyerPhone")}</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  lang="en" dir="ltr" inputMode="tel"
                  value={form.lawyerPhone}
                  onChange={(e) => set("lawyerPhone", e.target.value)}
                  placeholder="0600000000"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.courtCity")}</Label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  value={form.courtCity}
                  onChange={(e) => set("courtCity", e.target.value)}
                >
                  {MOROCCAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.filingDate")}</Label>
                <Input
                  type="date" lang="en" dir="ltr"
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.filingDate}
                  onChange={(e) => set("filingDate", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Case info */}
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-black/20 p-6 space-y-4">
            <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <Scale className="size-4" /> {t("lawyer.sectionCase")}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Client */}
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.clientName")} *</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.clientName}
                  onChange={(e) => set("clientName", e.target.value)}
                  placeholder={t("lawyer.clientNamePlaceholder")}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">عنوان الموكّل / Client address</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.clientAddress}
                  onChange={(e) => set("clientAddress", e.target.value)}
                  placeholder="ش. الحسن الثاني، الرباط"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">رقم ب.ت.و / CIN</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  lang="en" dir="ltr"
                  value={form.clientId}
                  onChange={(e) => set("clientId", e.target.value.toUpperCase())}
                  placeholder="AB123456"
                />
              </div>
              {/* Opposite */}
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.oppositeName")} *</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.oppositeName}
                  onChange={(e) => set("oppositeName", e.target.value)}
                  placeholder={t("lawyer.oppositeNamePlaceholder")}
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">عنوان المدعى عليه / Opposite address</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.oppositeAddress}
                  onChange={(e) => set("oppositeAddress", e.target.value)}
                  placeholder="الشارع، المدينة"
                />
              </div>
              {/* Case */}
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.caseNumber")}</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  lang="en" dir="ltr"
                  value={form.caseNumber}
                  onChange={(e) => set("caseNumber", e.target.value)}
                  placeholder="2026/0001"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.caseType")} *</Label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  value={form.caseType}
                  onChange={(e) => set("caseType", e.target.value as CaseType)}
                >
                  {CASE_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">{t("lawyer.courtName")} *</Label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  value={form.courtType}
                  onChange={(e) => set("courtType", e.target.value as CourtType)}
                >
                  {COURT_TYPES.map((ct) => <option key={ct} value={ct}>المحكمة {ct}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">الطلب الرئيسي / Main request</Label>
                <Input
                  className="mt-1 bg-black/40 border-white/15"
                  value={form.mainRequest}
                  onChange={(e) => set("mainRequest", e.target.value)}
                  placeholder="إلزام المدعى عليه بأداء مبلغ..."
                />
              </div>
            </div>

            {/* Brief description */}
            <div>
              <Label className="text-slate-300 text-xs">{t("lawyer.briefDesc")} *</Label>
              <p className="text-xs text-slate-500 mb-1">{t("lawyer.briefDescHint")}</p>
              <textarea
                className="w-full mt-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50 resize-y min-h-[100px]"
                value={form.briefDescription}
                onChange={(e) => set("briefDescription", e.target.value)}
                placeholder={t("lawyer.briefDescPlaceholder")}
                dir="rtl" lang="ar"
              />
            </div>

            <Button
              type="button"
              disabled={generating || !formReady}
              className="gap-2 bg-[#c9a227] hover:bg-amber-600 text-black font-bold"
              onClick={generateDraft}
            >
              {generating
                ? <Loader2 className="size-4 animate-spin" />
                : <Sparkles className="size-4" />}
              {t("lawyer.generateDraft")}
            </Button>
            {!formReady && (
              <p className="text-xs text-slate-500">
                * أدخل اسم المحامي والموكّل والطرف المقابل أولاً.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DRAFT
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "draft" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-emerald-500/25 bg-emerald-950/15">
            <Sparkles className="size-5 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-200 flex-1">{t("lawyer.draftHint")}</p>
            <Button
              type="button" size="sm" variant="secondary" className="gap-1.5"
              onClick={generateDraft} disabled={generating}
            >
              {generating
                ? <Loader2 className="size-3.5 animate-spin" />
                : <RefreshCw className="size-3.5" />}
              {t("lawyer.regenerate")}
            </Button>
          </div>

          {/* الوقائع */}
          <div className="rounded-2xl border border-[#c9a227]/40 bg-black/20 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-7 rounded-full bg-[#c9a227] block" />
              <h3 className="font-bold text-white text-base">{t("lawyer.facts")}</h3>
            </div>
            <p className="text-xs text-slate-500">
              يبدأ بـ «يتشرف العارض بأن ينهي إلى كريم علمكم ما يلي:» — عدّله بحرية.
            </p>
            <textarea
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50 resize-y min-h-[220px] leading-relaxed"
              value={form.facts}
              onChange={(e) => set("facts", e.target.value)}
              dir="rtl" lang="ar"
            />
          </div>

          {/* الحيثيات */}
          <div className="rounded-2xl border border-[#003876]/50 bg-black/20 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-7 rounded-full bg-[#003876] block" />
              <h3 className="font-bold text-white text-base">{t("lawyer.arguments")}</h3>
            </div>
            <p className="text-xs text-slate-500">
              يتضمن الأسانيد القانونية وعبارات «وحيث إن» — عدّله بحرية.
            </p>
            <textarea
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003876]/50 resize-y min-h-[240px] leading-relaxed"
              value={form.legalGrounds}
              onChange={(e) => set("legalGrounds", e.target.value)}
              dir="rtl" lang="ar"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="gap-2 bg-[#003876] hover:bg-[#004a99] text-white font-bold"
              onClick={handlePreview}
            >
              <Scale className="size-4" /> {t("lawyer.previewDoc")}
            </Button>
            <Button
              type="button"
              disabled={exporting}
              className="gap-2 bg-[#c9a227] hover:bg-amber-600 text-black font-bold"
              onClick={() => void exportPdf()}
            >
              {exporting
                ? <Loader2 className="size-4 animate-spin" />
                : <Download className="size-4" />}
              {t("lawyer.exportPdf")}
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PREVIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "preview" && previewHtml && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-slate-400">{t("lawyer.previewHint")}</p>
            <Button
              type="button"
              disabled={exporting}
              className="gap-2 bg-[#c9a227] hover:bg-amber-600 text-black font-bold"
              onClick={() => void exportPdf()}
            >
              {exporting
                ? <Loader2 className="size-4 animate-spin" />
                : <Download className="size-4" />}
              {t("lawyer.exportPdf")}
            </Button>
          </div>
          <div
            className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-white"
            style={{ height: "820px" }}
          >
            <iframe
              srcDoc={previewHtml}
              title={t("lawyer.previewTitle")}
              className="w-full h-full"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
