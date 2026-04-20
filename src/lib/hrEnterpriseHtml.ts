import { escapeHtmlPdf } from "@/lib/htmlEscape";

export type HrBranding = {
  companyName: string;
  logoDataUrl?: string;
};

function shell(
  branding: HrBranding,
  title: string,
  dir: "rtl" | "ltr",
  bodyHtml: string
): string {
  const logo =
    branding.logoDataUrl?.startsWith("data:image") && branding.logoDataUrl.length > 80
      ? `<img src="${escapeHtmlPdf(branding.logoDataUrl)}" alt="" class="print-keep" style="max-height:56px;max-width:180px;object-fit:contain;margin-bottom:10px;" />`
      : "";
  const cn = escapeHtmlPdf(branding.companyName || "—");
  const tt = escapeHtmlPdf(title);
  const align = dir === "rtl" ? "right" : "left";
  return `
<div style="font-family:'Noto Naskh Arabic',Arial,sans-serif;direction:${dir};text-align:${align};color:#0f172a;line-height:1.55;">
  <div style="padding:18px 20px;border-radius:16px;background:linear-gradient(135deg,#0052cc 0%,#003d99 40%,#ff8c00 100%);color:#fff;margin-bottom:18px;">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;justify-content:${dir === "rtl" ? "flex-end" : "flex-start"};">
      ${logo}
      <div style="flex:1;min-width:200px;">
        <div style="font-size:11px;opacity:0.9;letter-spacing:0.06em;">Smart Al-Idara Pro — Enterprise HR</div>
        <div style="font-size:20px;font-weight:800;margin-top:4px;">${cn}</div>
      </div>
    </div>
    <div style="margin-top:12px;font-size:17px;font-weight:700;border-top:1px solid rgba(255,255,255,0.25);padding-top:12px;">${tt}</div>
  </div>
  <div style="padding:4px 8px 8px;">${bodyHtml}</div>
  <div style="margin-top:22px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#64748b;text-align:center;">Smart Al-Idara Pro — ${cn}</div>
</div>`;
}

export function buildReturnToWorkHtml(params: {
  branding: HrBranding;
  employeeName: string;
  employeeId: string;
  absenceFrom: string;
  absenceTo: string;
  reason: string;
  returnDate: string;
  dir: "rtl" | "ltr";
  locale: string;
}): string {
  const { branding, dir } = params;
  const p = (k: string, v: string) =>
    `<p style="margin:10px 0;"><strong>${escapeHtmlPdf(k)}</strong> ${escapeHtmlPdf(v)}</p>`;
  const body =
    p("Employee / الموظف(ة):", params.employeeName) +
    p("ID / الرقم:", params.employeeId) +
    p("Absence period / فترة الغياب:", `${params.absenceFrom} → ${params.absenceTo}`) +
    p("Reason / السبب:", params.reason) +
    `<p style="margin:16px 0;padding:14px;border-radius:12px;background:linear-gradient(90deg,rgba(0,82,204,0.08),rgba(255,140,0,0.08));font-weight:600;">` +
    escapeHtmlPdf(
      params.locale.startsWith("ar")
        ? `يُشهد بأن الموظف(ة) أعلاه قد عاد(ت) إلى العمل بتاريخ ${params.returnDate}.`
        : params.locale.startsWith("fr")
          ? `Certifie que l’employé(e) ci-dessus a repris le travail le ${params.returnDate}.`
          : `This certifies that the above employee returned to work on ${params.returnDate}.`
    ) +
    `</p>`;
  const title =
    params.locale.startsWith("ar")
      ? "إشعار عودة إلى العمل"
      : params.locale.startsWith("fr")
        ? "Attestation de reprise de travail"
        : "Return to work notice";
  return shell(branding, title, dir, body);
}

export function buildDismissalNoticeHtml(params: {
  branding: HrBranding;
  employeeName: string;
  employeeId: string;
  dateNotice: string;
  grounds: string;
  dir: "rtl" | "ltr";
  locale: string;
}): string {
  const title =
    params.locale.startsWith("ar")
      ? "إشعار بالفصل (مسودة إدارية)"
      : params.locale.startsWith("fr")
        ? "Avis de licenciement (brouillon administratif)"
        : "Notice of dismissal (administrative draft)";
  const body =
    `<p style="margin:10px 0;"><strong>${escapeHtmlPdf(params.locale.startsWith("ar") ? "إلى السيد(ة)" : params.locale.startsWith("fr") ? "À" : "To")}</strong> ${escapeHtmlPdf(params.employeeName)} — ${escapeHtmlPdf(params.employeeId)}</p>` +
    `<p style="margin:12px 0;">${escapeHtmlPdf(params.dateNotice)}</p>` +
    `<div style="margin:14px 0;padding:14px;border-left:4px solid #dc2626;border-radius:8px;background:#fef2f2;">` +
    `<strong>${escapeHtmlPdf(params.locale.startsWith("ar") ? "الأسباب / الملاحظات" : params.locale.startsWith("fr") ? "Motifs" : "Grounds")}</strong><br/>` +
    escapeHtmlPdf(params.grounds) +
    `</div>` +
    `<p style="font-size:11px;color:#64748b;margin-top:18px;">${escapeHtmlPdf(
      params.locale.startsWith("ar")
        ? "مسودة إرشادية — يُراجع من طرف المختص قبل التسليم."
        : params.locale.startsWith("fr")
          ? "Brouillon indicatif — révision par un professionnel avant envoi."
          : "Indicative draft — review by counsel before delivery."
    )}</p>`;
  return shell(params.branding, title, params.dir, body);
}

export function buildWorkCertificateHtml(params: {
  branding: HrBranding;
  employeeName: string;
  employeeId: string;
  role: string;
  hireDate: string;
  endDate?: string;
  dir: "rtl" | "ltr";
  locale: string;
}): string {
  const title =
    params.locale.startsWith("ar")
      ? "شهادة عمل"
      : params.locale.startsWith("fr")
        ? "Certificat de travail"
        : "Work certificate";
  const body =
    `<p style="margin:12px 0;font-size:15px;">${escapeHtmlPdf(
      params.locale.startsWith("ar")
        ? "تشهد هذه الوثيقة بأن:"
        : params.locale.startsWith("fr")
          ? "La présente atteste que :"
          : "This certifies that:"
    )}</p>` +
    `<p style="margin:8px 0;"><strong>ID</strong> ${escapeHtmlPdf(params.employeeId)} — ${escapeHtmlPdf(params.employeeName)}</p>` +
    `<p style="margin:8px 0;"><strong>${escapeHtmlPdf(params.locale.startsWith("fr") ? "Fonction" : params.locale.startsWith("ar") ? "المهمة" : "Role")}</strong> ${escapeHtmlPdf(params.role)}</p>` +
    `<p style="margin:8px 0;"><strong>${escapeHtmlPdf(params.locale.startsWith("ar") ? "تاريخ التوظيف" : params.locale.startsWith("fr") ? "Date d’embauche" : "Hire date")}</strong> ${escapeHtmlPdf(params.hireDate)}</p>` +
    (params.endDate
      ? `<p style="margin:8px 0;"><strong>${escapeHtmlPdf(params.locale.startsWith("ar") ? "نهاية العقد" : "End")}</strong> ${escapeHtmlPdf(params.endDate)}</p>`
      : "") +
    `<p style="margin:24px 0 8px;">${escapeHtmlPdf(
      params.locale.startsWith("ar")
        ? "حررت للإدلاء بها حيثما يُطلب."
        : params.locale.startsWith("fr")
          ? "Pour servir et valoir ce que de droit."
          : "Issued upon request."
    )}</p>`;
  return shell(params.branding, title, params.dir, body);
}

export function buildSalarySocialHtml(params: {
  branding: HrBranding;
  employeeName: string;
  employeeId: string;
  period: string;
  grossSalary: string;
  cnssNumber: string;
  amoNumber: string;
  mutualName: string;
  mutualId: string;
  dir: "rtl" | "ltr";
  locale: string;
}): string {
  const title =
    params.locale.startsWith("ar")
      ? "تقرير أجور / تأمينات (إرشادي)"
      : params.locale.startsWith("fr")
        ? "Bulletin / attestations sociales (indicatif)"
        : "Salary & social insurance summary (indicative)";
  const rows = [
    [params.locale.startsWith("ar") ? "الموظف" : params.locale.startsWith("fr") ? "Employé" : "Employee", `${params.employeeName} (${params.employeeId})`],
    [params.locale.startsWith("ar") ? "الفترة" : "Period", params.period],
    [params.locale.startsWith("ar") ? "الأجر الإجمالي" : params.locale.startsWith("fr") ? "Salaire brut" : "Gross", params.grossSalary + " MAD"],
    ["CNSS", params.cnssNumber],
    ["AMO", params.amoNumber],
    [params.locale.startsWith("ar") ? "التأمين التكميلي" : "Mutuelle", params.mutualName],
    [params.locale.startsWith("ar") ? "رقم المنخرط" : "Member ID", params.mutualId],
  ];
  const tr = rows
    .map(
      ([a, b]) =>
        `<tr><td style="border:1px solid #cbd5e1;padding:10px;background:#f8fafc;font-weight:700;">${escapeHtmlPdf(a)}</td><td style="border:1px solid #cbd5e1;padding:10px;">${escapeHtmlPdf(b)}</td></tr>`
    )
    .join("");
  const body = `<table style="width:100%;border-collapse:collapse;font-size:13px;">${tr}</table>`;
  return shell(params.branding, title, params.dir, body);
}

export function buildInternalRulesAckHtml(params: {
  branding: HrBranding;
  employeeName: string;
  employeeId: string;
  rulesExcerpt: string;
  ackDate: string;
  dir: "rtl" | "ltr";
  locale: string;
}): string {
  const title =
    params.locale.startsWith("ar")
      ? "النظام الداخلي — إقرار بالاطلاع"
      : params.locale.startsWith("fr")
        ? "Règlement intérieur — accusé de lecture"
        : "Internal regulations — acknowledgment";
  const body =
    `<p style="margin:8px 0;">${escapeHtmlPdf(params.employeeName)} — ${escapeHtmlPdf(params.employeeId)}</p>` +
    `<div style="margin:12px 0;padding:14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;">${escapeHtmlPdf(params.rulesExcerpt).replace(/\n/g, "<br/>")}</div>` +
    `<p style="margin:16px 0;font-weight:600;">${escapeHtmlPdf(
      params.locale.startsWith("ar")
        ? `أقر بأنني اطلعت على النظام الداخلي بتاريخ ${params.ackDate}.`
        : params.locale.startsWith("fr")
          ? `Je reconnais avoir pris connaissance du règlement intérieur le ${params.ackDate}.`
          : `I acknowledge reading the internal regulations on ${params.ackDate}.`
    )}</p>`;
  return shell(params.branding, title, params.dir, body);
}

export function buildEmploymentContractHtml(params: {
  branding: HrBranding;
  bodyText: string;
  dir: "rtl" | "ltr";
  locale: string;
}): string {
  const title =
    params.locale.startsWith("ar")
      ? "عقد عمل — مسودة"
      : params.locale.startsWith("fr")
        ? "Contrat de travail — projet"
        : "Employment contract — draft";
  const safe = escapeHtmlPdf(params.bodyText).replace(/\n/g, "<br/>");
  const body = `<div style="font-size:13px;">${safe}</div>`;
  return shell(params.branding, title, params.dir, body);
}
