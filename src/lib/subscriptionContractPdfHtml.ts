import { escapeHtmlPdf } from "@/lib/htmlEscape";

const FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
`;

/** Professional theme: Vibrant Blue / Clean White / Soft Gray — governmental/official look */
const THEME = {
  blue: "#0052CC",
  blueDark: "#003d99",
  blueLight: "#e8f0fe",
  green: "#006233",
  red: "#C1272D",
  ink: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
  rowAlt: "#f8fafc",
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
    <div class="cell ar" dir="rtl">
      <div class="lab" style="text-align:right;">${escapeHtmlPdf(labelAr)}</div>
      <div class="val" style="text-align:right;direction:rtl;unicode-bidi:plaintext;">${escapeHtmlPdf(valueAr)}</div>
    </div>
    <div class="cell other" dir="ltr">
      <div class="lab" style="text-align:left;">${escapeHtmlPdf(labelOther)}</div>
      <div class="val" style="text-align:left;direction:ltr;">${escapeHtmlPdf(valueOther)}</div>
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
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      /* Force Western/Latin digits (0-9) — prevent Arabic-Indic numerals in PDF */
      font-variant-numeric: lining-nums tabular-nums;
      -webkit-font-feature-settings: "lnum" 1, "tnum" 1;
      font-feature-settings: "lnum" 1, "tnum" 1;
    }
    body {
      padding: 16px 14px 28px;
      color: ${THEME.ink};
      font-family: "Noto Sans", "Noto Naskh Arabic", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
    }
    .sheet {
      max-width: 780px;
      margin: 0 auto;
      background: #fff;
    }

    /* ── Header ── */
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      margin-bottom: 14px;
      border-radius: 10px;
      background: linear-gradient(135deg, ${THEME.blueDark} 0%, ${THEME.blue} 100%);
      color: #fff;
    }
    .head img.logo {
      height: 52px;
      width: auto;
      object-fit: contain;
      background: rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 4px;
    }
    .head .titles { flex: 1; text-align: center; }
    .head h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      font-family: Cairo, "Noto Naskh Arabic", sans-serif;
      color: #fff;
      letter-spacing: 0.02em;
    }
    .head .sub {
      margin: 5px 0 0;
      font-size: 11px;
      color: rgba(255,255,255,0.82);
      font-weight: 600;
    }

    /* ── Kingdom line ── */
    .kingdom {
      text-align: center;
      font-size: 11.5px;
      font-weight: 700;
      margin-bottom: 12px;
      color: ${THEME.ink};
      font-family: Cairo, "Noto Naskh Arabic", sans-serif;
      padding: 6px 0;
      border-bottom: 2px solid ${THEME.blue};
    }

    /* ── Column headers ── */
    .cols-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin-bottom: 6px;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-radius: 6px 6px 0 0;
      overflow: hidden;
    }
    .cols-header .ch-ar {
      direction: rtl;
      text-align: right;
      font-family: Cairo, "Noto Naskh Arabic", sans-serif;
      background: ${THEME.blue};
      color: #fff;
      padding: 7px 12px;
      border-left: 1px solid rgba(255,255,255,0.2);
    }
    .cols-header .ch-other {
      direction: ltr;
      text-align: left;
      background: ${THEME.blueDark};
      color: #fff;
      padding: 7px 12px;
    }

    /* ── Data rows ── */
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border: 1px solid ${THEME.border};
      border-top: none;
      margin-bottom: 0;
      overflow: hidden;
    }
    .row:last-of-type { border-radius: 0 0 6px 6px; margin-bottom: 10px; }
    .row:nth-child(even) .cell { background: ${THEME.blueLight}; }

    /* Arabic cell — explicit RTL + right-aligned */
    .cell {
      padding: 9px 12px;
      vertical-align: top;
      font-size: 9.5pt;
      line-height: 1.5;
    }
    .cell.ar {
      direction: rtl;
      text-align: right;
      unicode-bidi: plaintext;
      background: ${THEME.rowAlt};
      border-left: 2px solid ${THEME.blue};
      font-family: "Noto Naskh Arabic", Cairo, sans-serif;
    }
    .cell.other {
      direction: ltr;
      text-align: left;
      background: #fff;
    }
    .lab {
      font-size: 8pt;
      font-weight: 700;
      color: ${THEME.blue};
      margin-bottom: 4px;
      letter-spacing: 0.03em;
    }
    .val { white-space: pre-wrap; word-break: break-word; color: ${THEME.ink}; }

    /* ── Clauses ── */
    .clauses-title {
      font-size: 10pt;
      font-weight: 700;
      color: ${THEME.blue};
      margin: 16px 0 6px;
      padding: 6px 12px;
      background: ${THEME.blueLight};
      border-right: 4px solid ${THEME.blue};
      border-radius: 4px;
    }
    .clause {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 10px;
      padding: 10px 0;
      border-top: 1px dashed ${THEME.border};
    }
    .clause p { margin: 0 0 8px; font-size: 9.5pt; line-height: 1.6; }
    .clause-ar {
      direction: rtl;
      text-align: right;
      unicode-bidi: plaintext;
      font-family: "Noto Naskh Arabic", Cairo, sans-serif;
    }
    .clause-other {
      direction: ltr;
      text-align: left;
      font-family: "Noto Sans", Arial, sans-serif;
    }

    /* ── Footer ── */
    .foot {
      margin-top: 20px;
      padding: 10px 16px;
      border-top: 3px solid ${THEME.blue};
      font-size: 8pt;
      color: ${THEME.muted};
      text-align: center;
      line-height: 1.5;
      background: ${THEME.blueLight};
      border-radius: 0 0 6px 6px;
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
