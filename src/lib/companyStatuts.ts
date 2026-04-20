/** النظام الأساسي SARLAU — وثيقة رسمية (أبيض/أسود) حسب لغة الواجهة */

import type { AppLocale } from "@/i18n/strings";
import { buildEnStatutsHtml, buildEsStatutsHtml, buildFrStatutsHtml } from "@/lib/companyStatutsLocales";

export type StatutsParams = {
  denomination: string;
  capital: string;
  siege: string;
  objet: string;
  associes: string;
  dateIso: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function annexChecklistAr() {
  return `
<p style="margin-top:20px;padding-top:16px;border-top:1px solid #000"><strong>ملحق — مسطرة الإيداع والمصادقة (إرشادية)</strong></p>
<p><strong>1) المحكمة التجارية والسجل التجاري:</strong> إيداع النظام الأساسي أو تعديله لدى كتابة ضبط المحكمة التجارية المختصة؛ قيد الشركة أو تعديلها في السجل التجاري وفق مدونة الشركات.</p>
<p><strong>2) الإدارة الضريبية (DGI):</strong> التصريح بالهوية الضريبية وتحديث الوضع الضريبي وفق النصوص الجاري بها العمل.</p>
<p><strong>3) الشكل والتوقيعات:</strong> التحقق من صحة التوقيعات؛ مطابقة النسخ للأصل؛ إرفاق نسخ الهوية أو التمثيل القانوني عند الاقتضاء.</p>
<p><strong>4) إخلاء مسؤولية:</strong> مسودة إرشادية؛ لا تغني عن الاستشارة المهنية؛ لا تُعتبر نهائية إلا بعد المصادقة والتوقيع لدى الجهات المختصة.</p>
`;
}

function buildArStatutsHtml(p: StatutsParams): string {
  const styles = `
    @media print {
      .screen-only { display: none !important; }
      body { background: #fff !important; color: #000 !important; }
    }
  `;
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${esc(p.denomination)} — النظام الأساسي</title>
<style>${styles}</style></head>
<body style="font-family:'Noto Naskh Arabic','Noto Sans','Segoe UI',serif;line-height:1.85;padding:32px;max-width:800px;margin:0 auto;color:#000;background:#fff">
<div style="text-align:center;font-weight:700;font-size:18px;margin-bottom:4px">المملكة المغربية</div>
<div style="text-align:center;font-size:13px;margin-bottom:20px;color:#000">النظام الأساسي لشركة ذات مسؤولية محدودة ذات شريك واحد (SARLAU)</div>
<p style="font-size:12px;text-align:justify;color:#000;margin-bottom:20px"><strong>المرجع القانوني:</strong> يُؤسَّس هذا النظام الأساسي وفق أحكام <strong>القانون رقم 5.15 المتعلق بمدونة الشركات</strong> الصادر بتنفيذه الظهير الشريف رقم 1.15.16 بتاريخ 20 غشت 2015 وتعديلاته، والنصوص التنظيمية الجاري بها العمل، وعلى الأخص الأحكام المتعلقة بشركة ذات مسؤولية محدودة ذات شريك واحد.</p>

<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px;color:#000">الباب الأول — التسمية والشكل والمدة والمركز الاجتماعي</h2>
<p style="color:#000"><strong>المادة 1 — الشكل والتسمية:</strong> تُؤسَّس شركة ذات مسؤولية محدودة ذات شريك واحد، وتُسمَّى: «${esc(p.denomination)}».</p>
<p style="color:#000"><strong>المادة 2 — المدة:</strong> تبدأ مدة الشركة من تاريخ قيدها في السجل التجاري؛ وتنتهي بتاريخ ………… ما لم يُقرَّر تمديدها بقرار الشريك وفق القانون.</p>
<p style="color:#000"><strong>المادة 3 — المركز الاجتماعي:</strong> يقع المركز الاجتماعي للشركة في: ${esc(p.siege)}. يجوز بناءً على قرار الشريك نقل المركز إلى عنوان آخر داخل المملكة مع استيفاء الإجراءات القانونية والتجارية والضريبية.</p>

<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px;color:#000">الباب الثاني — الغرض الاجتماعي</h2>
<p style="color:#000"><strong>المادة 4 — الغرض:</strong> يتمثل الغرض الاجتماعي للشركة في: ${esc(p.objet)}. ويجوز للشركة، بقرار الشريك، إضافة أنشطة متلائمة مع غرضها أو تعديله مع مراعاة الإجراءات المنصوص عليها قانوناً.</p>

<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px;color:#000">الباب الثالث — رأس المال والحصص</h2>
<p style="color:#000"><strong>المادة 5 — رأس المال:</strong> يحدد رأس المال الاجتماعي في مبلغ <strong>${esc(p.capital)} درهم</strong>، يشكل حصة واحدة أو عدة حصص يملكها الشريك الوحيد، وفق جدول الحصص المرفق أو المبين أدناه، ويُسجَّل لدى الجهات المختصة.</p>
<p style="color:#000"><strong>المادة 6 — مسؤولية الشريك:</strong> لا يتعدى التزام الشريك بما يملك من حصص في رأس المال؛ ولا تضامن بين الشريك والشركة في التزاماتها إلا في الحدود المنصوص عليها قانوناً.</p>

<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px;color:#000">الباب الرابع — الشريك الوحيد</h2>
<p style="color:#000"><strong>المادة 7 — هوية الشريك:</strong> الشريك الوحيد هو: ${esc(p.associes)}</p>
<p style="color:#000"><strong>المادة 8 — القرارات:</strong> يتخذ الشريك وحده القرارات المتعلقة بإدارة الشركة ومسارها، بما يتوافق مع القانون والنظام الأساسي، ويُثبت ذلك في محاضر أو قرارات وفق الشكل المطلوب للإيداع والنشر عند الاقتضاء.</p>

<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px;color:#000">الباب الخامس — التسيير</h2>
<p style="color:#000"><strong>المادة 9 — التسيير:</strong> تُدار الشركة من طرف <strong>مدير أو أكثر</strong> يعينهم الشريك الوحيد. يمثل المدير الشركة تجاه الغير في حدود الصلاحيات الممنوحة له.</p>
<p style="color:#000"><strong>المادة 10 — التفويض:</strong> يجوز للمدير تفويض بعض الصلاحيات بما لا يتنافى مع القانون، مع بقاء مسؤوليته عن التصرفات التي تدخل في اختصاصه الأساسي.</p>

<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px;color:#000">الباب السادس — السنة المالية والمحاسبة</h2>
<p style="color:#000"><strong>المادة 11 — السنة المالية:</strong> تبدأ السنة المالية للشركة في ………… وتنتهي في ………… ما لم يُقرَّر غير ذلك وفق القانون.</p>
<p style="color:#000"><strong>المادة 12 — المحاسبة:</strong> تُمسك الشركة محاسبتها وفق القواعد المعمول بها؛ ويُودع لدى الإدارة الضريبية والجهات المختصة ما يُوجب القانون من تصاريح ووثائق.</p>

<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px;color:#000">الباب السابع — حلول ونزاعات</h2>
<p style="color:#000"><strong>المادة 13 — التعديل:</strong> يُعدَّل هذا النظام الأساسي بقرار الشريك وفق الإجراءات المنصوص عليها في مدونة الشركات وفي السجل التجاري.</p>
<p style="color:#000"><strong>المادة 14 — الانحلال والتصفية:</strong> تُحل الشركة وتُصفّى للأسباب المنصوص عليها قانوناً؛ وتُعيَّن المصفي أو المصفون وفق القواعد المطبقة.</p>
<p style="color:#000"><strong>المادة 15 — النزاعات:</strong> تُحال المنازعات الناشئة عن تطبيق هذا النظام الأساسي، ما لم يُتفق على غير ذلك، إلى المحاكم المختصة بالمملكة المغربية.</p>

<p style="margin-top:28px;font-size:12px;color:#000">تاريخ إعداد المسودة: ${esc(p.dateIso)}</p>
<p style="margin-top:40px;font-size:13px;color:#000"><strong>التوقيعات</strong></p>
<p style="margin-top:24px;color:#000">الشريك الوحيد: __________________________ &nbsp;&nbsp;&nbsp; التاريخ: __________</p>
<p style="margin-top:16px;color:#000">المدير (إن اختلف عن الشريك): __________________________ &nbsp;&nbsp;&nbsp; التاريخ: __________</p>

<div style="page-break-before:always;margin-top:40px;padding-top:24px"></div>
<div style="text-align:center;font-weight:700;font-size:17px;margin-bottom:16px;color:#000">المملكة المغربية</div>
${annexChecklistAr()}
<p class="screen-only" style="font-size:10px;color:#000;margin-top:16px">معاينة شاشة — استخدم تصدير PDF للطباعة.</p>
</body></html>`;
}

export function buildSarlStatutsHtml(locale: AppLocale, p: StatutsParams): string {
  if (locale.startsWith("ar")) return buildArStatutsHtml(p);
  if (locale === "fr") return buildFrStatutsHtml(p);
  if (locale === "es") return buildEsStatutsHtml(p);
  return buildEnStatutsHtml(p);
}
