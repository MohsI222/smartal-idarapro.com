import { escapeHtmlPdf } from "@/lib/htmlEscape";

const FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
`;

/** Couleurs drapeau marocain (pro) : vert, rouge — usage sobre sur bandeaux et filets */
const THEME = {
  green: "#006233",
  red: "#C1272D",
  ink: "#0f172a",
  muted: "#475569",
};

export type SubscriptionContractFieldSet = {
  directorName: string;
  directorCin: string;
  directorAddress: string;
  directorPhone: string;
  subscriberName: string;
  subscriberCin: string;
  subscriberAddress: string;
  subscriberPhone: string;
  entityTypeLabelAr: string;
  entityTypeLabelOther: string;
  planLabelAr: string;
  planLabelOther: string;
  billingPeriodLabelAr: string;
  billingPeriodLabelOther: string;
  priceDh: number;
  startDate: string;
  endDate: string;
  signaturePlace: string;
  paymentNoteAr: string;
  paymentNoteOther: string;
  /** Libellés des lignes (bilingues) */
  rowLabels: {
    partyAAr: string;
    partyAOther: string;
    partyBAr: string;
    partyBOther: string;
    entityAr: string;
    entityOther: string;
    planAr: string;
    planOther: string;
    billingAr: string;
    billingOther: string;
    feeAr: string;
    feeOther: string;
    startAr: string;
    startOther: string;
    endAr: string;
    endOther: string;
    placeAr: string;
    placeOther: string;
    payAr: string;
    payOther: string;
  };
};

export type ContractPdfClauseCopy = {
  docTitleAr: string;
  docTitleOther: string;
  kingdomAr: string;
  kingdomOther: string;
  introAr: string;
  introOther: string;
  partiesAr: string;
  partiesOther: string;
  objectAr: string;
  objectOther: string;
  financialAr: string;
  financialOther: string;
  durationAr: string;
  durationOther: string;
  validityAr: string;
  validityOther: string;
  signaturesAr: string;
  signaturesOther: string;
  colArabic: string;
  colTranslation: string;
};

function rowPair(
  labelAr: string,
  labelOther: string,
  valueAr: string,
  valueOther: string
): string {
  return `
  <div class="row">
    <div class="cell ar">
      <div class="lab">${escapeHtmlPdf(labelAr)}</div>
      <div class="val">${escapeHtmlPdf(valueAr)}</div>
    </div>
    <div class="cell other">
      <div class="lab">${escapeHtmlPdf(labelOther)}</div>
      <div class="val">${escapeHtmlPdf(valueOther)}</div>
    </div>
  </div>`;
}

/**
 * Document HTML A4 — deux colonnes (arabe fixe | langue choisie), prêt pour capture PDF (html2canvas + jsPDF).
 */
export function buildSubscriptionContractPdfHtml(opts: {
  fields: SubscriptionContractFieldSet;
  clauses: ContractPdfClauseCopy;
  logoSrc: string;
}): string {
  const { fields, clauses, logoSrc } = opts;
  const safeLogo = escapeHtmlPdf(logoSrc);

  const priceStr = String(fields.priceDh ?? 0);
  const L = fields.rowLabels;

  const gridBlock = rowPair(
    L.partyAAr,
    L.partyAOther,
    `الاسم: ${fields.directorName}\nالبطاقة الوطنية: ${fields.directorCin}\nالعنوان: ${fields.directorAddress}\nالهاتف: ${fields.directorPhone}`,
    `Name: ${fields.directorName}\nNational ID: ${fields.directorCin}\nAddress: ${fields.directorAddress}\nPhone: ${fields.directorPhone}`
  )
    + rowPair(
        L.partyBAr,
        L.partyBOther,
        `الاسم: ${fields.subscriberName}\nالبطاقة الوطنية: ${fields.subscriberCin}\nالعنوان: ${fields.subscriberAddress}\nالهاتف: ${fields.subscriberPhone}`,
        `Name: ${fields.subscriberName}\nNational ID: ${fields.subscriberCin}\nAddress: ${fields.subscriberAddress}\nPhone: ${fields.subscriberPhone}`
      )
    + rowPair(L.entityAr, L.entityOther, fields.entityTypeLabelAr, fields.entityTypeLabelOther)
    + rowPair(L.planAr, L.planOther, fields.planLabelAr, fields.planLabelOther)
    + rowPair(L.billingAr, L.billingOther, fields.billingPeriodLabelAr, fields.billingPeriodLabelOther)
    + rowPair(L.feeAr, L.feeOther, `${priceStr} درهم`, `${priceStr} MAD`)
    + rowPair(L.startAr, L.startOther, fields.startDate, fields.startDate)
    + rowPair(L.endAr, L.endOther, fields.endDate, fields.endDate)
    + rowPair(L.placeAr, L.placeOther, fields.signaturePlace, fields.signaturePlace)
    + rowPair(L.payAr, L.payOther, fields.paymentNoteAr, fields.paymentNoteOther);

  const clauseBlock = (ar: string, other: string) => {
    const a = escapeHtmlPdf(ar).replace(/\n/g, "<br/>");
    const o = escapeHtmlPdf(other).replace(/\n/g, "<br/>");
    return `
  <div class="clause">
    <div class="clause-ar" dir="rtl"><p>${a}</p></div>
    <div class="clause-other" dir="ltr"><p>${o}</p></div>
  </div>`;
  };

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlPdf(clauses.docTitleAr)}</title>
  ${FONT_LINKS}
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px 14px 28px;
      background: #fff;
      color: ${THEME.ink};
      font-family: "Noto Sans", "Noto Naskh Arabic", Arial, sans-serif;
    }
    .sheet {
      max-width: 780px;
      margin: 0 auto;
      background: #fff;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 12px;
      margin-bottom: 14px;
      border-bottom: 4px solid ${THEME.red};
      background: linear-gradient(90deg, rgba(0,98,51,0.08), rgba(193,39,45,0.06));
      padding: 12px 14px;
      border-radius: 8px;
    }
    .head img.logo { height: 52px; width: auto; object-fit: contain; }
    .head .titles { flex: 1; text-align: center; }
    .head h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      font-family: Cairo, "Noto Naskh Arabic", sans-serif;
      color: ${THEME.green};
    }
    .head .sub {
      margin: 4px 0 0;
      font-size: 11px;
      color: ${THEME.muted};
      font-weight: 600;
    }
    .cols-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .cols-header .ch-ar {
      text-align: right;
      font-family: Cairo, "Noto Naskh Arabic", sans-serif;
      color: ${THEME.green};
      border-bottom: 2px solid ${THEME.green};
      padding-bottom: 4px;
    }
    .cols-header .ch-other {
      text-align: left;
      color: ${THEME.red};
      border-bottom: 2px solid ${THEME.red};
      padding-bottom: 4px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 6px;
      overflow: hidden;
    }
    .cell {
      padding: 8px 10px;
      vertical-align: top;
      font-size: 9.5pt;
      line-height: 1.45;
    }
    .cell.ar {
      background: #f8fafc;
      border-inline-end: 1px solid #e2e8f0;
      font-family: "Noto Naskh Arabic", Cairo, sans-serif;
    }
    .cell.other { background: #fff; }
    .lab { font-size: 8.5pt; font-weight: 700; color: ${THEME.muted}; margin-bottom: 4px; }
    .val { white-space: pre-wrap; word-break: break-word; }
    .clause {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
    }
    .clause p { margin: 0 0 8px; font-size: 9.5pt; line-height: 1.5; }
    .clause-ar { font-family: "Noto Naskh Arabic", Cairo, sans-serif; }
    .clause-other { font-family: "Noto Sans", Arial, sans-serif; }
    .kingdom {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 10px;
      color: ${THEME.ink};
      font-family: Cairo, "Noto Naskh Arabic", sans-serif;
    }
    .foot {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 2px solid ${THEME.green};
      font-size: 8pt;
      color: ${THEME.muted};
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="head">
      <img class="logo print-keep" src="${safeLogo}" width="120" height="52" alt="" />
      <div class="titles">
        <h1>${escapeHtmlPdf(clauses.docTitleAr)}</h1>
        <p class="sub" dir="ltr" style="text-align:center;">${escapeHtmlPdf(clauses.docTitleOther)}</p>
      </div>
      <div style="width:120px;height:52px;"></div>
    </header>
    <div class="kingdom" dir="rtl">${escapeHtmlPdf(clauses.kingdomAr)} — ${escapeHtmlPdf(clauses.kingdomOther)}</div>
    <div class="cols-header">
      <div class="ch-ar">${escapeHtmlPdf(clauses.colArabic)}</div>
      <div class="ch-other">${escapeHtmlPdf(clauses.colTranslation)}</div>
    </div>
    ${gridBlock}
    ${clauseBlock(clauses.introAr, clauses.introOther)}
    ${clauseBlock(clauses.partiesAr, clauses.partiesOther)}
    ${clauseBlock(clauses.objectAr, clauses.objectOther)}
    ${clauseBlock(clauses.financialAr, clauses.financialOther)}
    ${clauseBlock(clauses.durationAr, clauses.durationOther)}
    ${clauseBlock(clauses.validityAr, clauses.validityOther)}
    ${clauseBlock(clauses.signaturesAr, clauses.signaturesOther)}
    <footer class="foot">
      Smart Al-Idara Pro — وثيقة إطار للتوقيع والتصديق أمام السلطات المختصة — نموذج إرشادي يُستكمل بحسب الحالة الفردية.
    </footer>
  </div>
</body>
</html>`;
}
