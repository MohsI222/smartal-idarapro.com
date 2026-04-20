import { escapeHtmlPdf } from "@/lib/htmlEscape";
import { formatLatinDateTime } from "@/lib/tlLatinNums";
import type { MemberRow } from "@/lib/memberMgmtTypes";
import { ORG_LABELS, memberStatusLabel, type OrgKind } from "@/lib/memberMgmtTypes";

function schedulePrint(w: Window): void {
  const run = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  const schedule = () => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(run)));
  if (w.document.readyState === "complete") schedule();
  else w.addEventListener("load", () => schedule(), { once: true });
}

/**
 * نافذة طباعة / حفظ PDF ملوّنة للمنخرطين — «حفظ كـ PDF» من مربع حوار الطباعة.
 */
export function openMemberMgmtColorPdf(opts: {
  orgKind: OrgKind;
  orgName: string;
  logoDataUrl: string | null;
  members: MemberRow[];
  sectionTitle: string;
}): void {
  const { orgKind, orgName, logoDataUrl, members, sectionTitle } = opts;
  const kindLabel = ORG_LABELS[orgKind];
  const dateStr = escapeHtmlPdf(formatLatinDateTime("ar-MA"));

  const rowsHtml = members
    .map((m) => {
      const st = memberStatusLabel(m);
      const paid = st === "Paid";
      const bg = paid ? "#ecfdf5" : "#fef2f2";
      const fg = paid ? "#047857" : "#b91c1c";
      const label = paid ? "مدفوع" : "غير مدفوع";
      return `<tr style="background:${bg};">
        <td style="border:1px solid #e2e8f0;padding:8px 10px;">${escapeHtmlPdf(m.fullName)}</td>
        <td style="border:1px solid #e2e8f0;padding:8px 10px;">${escapeHtmlPdf(m.nationalId)}</td>
        <td style="border:1px solid #e2e8f0;padding:8px 10px;">${escapeHtmlPdf(m.membershipNo)}</td>
        <td style="border:1px solid #e2e8f0;padding:8px 10px;">${escapeHtmlPdf(m.regDate)}</td>
        <td style="border:1px solid #e2e8f0;padding:8px 10px;">${escapeHtmlPdf(m.endDate)}</td>
        <td style="border:1px solid #e2e8f0;padding:8px 10px;">${escapeHtmlPdf(String(m.amountDh))}</td>
        <td style="border:1px solid #e2e8f0;padding:8px 10px;font-weight:700;color:${fg};">${escapeHtmlPdf(label)}</td>
      </tr>`;
    })
    .join("");

  const logoSafe = logoDataUrl?.startsWith("data:image/") ? logoDataUrl.replace(/&/g, "&amp;") : "";
  const logoBlock = logoSafe
    ? `<img src="${logoSafe}" alt="" class="mm-logo" style="max-height:56px;max-width:140px;object-fit:contain;border-radius:8px;" />`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlPdf(sectionTitle)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body {
      margin: 0;
      padding: 16px;
      font-family: "Segoe UI", Tahoma, Arial, "Noto Naskh Arabic", sans-serif;
      background: linear-gradient(165deg, #f8fafc 0%, #eef2ff 45%, #fdf4ff 100%);
      color: #0f172a;
    }
    .mm-wrap { max-width: 1200px; margin: 0 auto; }
    .mm-hero {
      border-radius: 16px;
      padding: 20px 24px;
      background: linear-gradient(120deg, #6366f1 0%, #a855f7 40%, #ec4899 100%);
      color: #fff;
      box-shadow: 0 20px 50px rgba(99, 102, 241, 0.35);
    }
    .mm-hero h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; }
    .mm-hero p { margin: 0; opacity: 0.95; font-size: 13px; }
    .mm-meta { margin-top: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 16px; justify-content: space-between; }
    .mm-table-wrap {
      margin-top: 18px;
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(8px);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.8);
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11.5pt; }
    thead th {
      background: linear-gradient(90deg, #4f46e5, #7c3aed);
      color: #fff;
      padding: 10px 8px;
      text-align: right;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .mm-foot {
      margin-top: 14px;
      text-align: center;
      font-size: 10px;
      color: #64748b;
    }
    @media print {
      body {
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .mm-hero {
        box-shadow: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      thead th {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tr {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .mm-table-wrap { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="mm-wrap">
    <div class="mm-hero">
      <div class="mm-meta">
        <div style="display:flex;align-items:center;gap:14px;">
          ${logoBlock}
          <div>
            <h1>${escapeHtmlPdf(orgName || "—")}</h1>
            <p>${escapeHtmlPdf(kindLabel)} — ${escapeHtmlPdf(sectionTitle)}</p>
          </div>
        </div>
        <div style="font-size:12px;">${dateStr}</div>
      </div>
    </div>
    <div class="mm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>الاسم الكامل</th>
            <th>رقم البطاقة الوطنية</th>
            <th>رقم الانخراط</th>
            <th>تاريخ التسجيل</th>
            <th>تاريخ الانتهاء</th>
            <th>المبلغ (درهم)</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="7" style="padding:16px;text-align:center;color:#64748b;">لا توجد بيانات</td></tr>`}
        </tbody>
      </table>
    </div>
    <p class="mm-foot">الإدارة برو — تصدير المنخرطين — استخدم «حفظ كـ PDF» من نافذة الطباعة</p>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  schedulePrint(w);
}
