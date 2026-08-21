/**
 * تصدير تقارير المبيعات (PDF / Excel) — قسم رادار الطلبات والتوصيل.
 * يعتمد على مكتبات التصدير الموجودة في المشروع (jsPDF/html2canvas عبر pdfExport، وExcelJS عبر excelStyles)
 * دون أي تعديل عليها — استيراد فقط.
 */
import ExcelJS from "exceljs";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { escapeHtmlPdf } from "@/lib/htmlEscape";
import { ensureExportLibrariesReady } from "@/lib/exportLibraries";
import { applyBordersToRange, styleDataRow, styleHeaderRow, styleTitleRow } from "@/lib/excelStyles";
import { ORDER_STATUS_LABELS, type Order, type Store } from "@/lib/deliveryHub/types";

export type SalesReport = {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  revenueAllTime: number;
  ordersToday: number;
  completedOrders: number;
  cancelledOrders: number;
  activeOrders: number;
  averageOrderValue: number;
  statusCounts: Record<string, number>;
  topProducts: { title: string; quantity: number; revenue: number }[];
  dailyRevenue: { day: string; revenue: number }[];
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** يحسب تقرير مبيعات حقيقي من قائمة الطلبات الفعلية (الطلبات المكتملة فقط تُحتسب كإيرادات). */
export function buildSalesReport(orders: Order[]): SalesReport {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completed = orders.filter((o) => o.status === "completed");
  const revenueToday = completed
    .filter((o) => isSameDay(new Date(o.updated_at), now))
    .reduce((sum, o) => sum + o.total, 0);
  const revenueWeek = completed
    .filter((o) => new Date(o.updated_at) >= startOfWeek)
    .reduce((sum, o) => sum + o.total, 0);
  const revenueMonth = completed
    .filter((o) => new Date(o.updated_at) >= startOfMonth)
    .reduce((sum, o) => sum + o.total, 0);
  const revenueAllTime = completed.reduce((sum, o) => sum + o.total, 0);

  const ordersToday = orders.filter((o) => isSameDay(new Date(o.created_at), now)).length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "delivering").length;
  const averageOrderValue = completed.length > 0 ? revenueAllTime / completed.length : 0;

  const statusCounts: Record<string, number> = {};
  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }

  const productMap = new Map<string, { quantity: number; revenue: number }>();
  for (const order of completed) {
    for (const item of order.order_items ?? []) {
      const entry = productMap.get(item.title) ?? { quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.price * item.quantity;
      productMap.set(item.title, entry);
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([title, v]) => ({ title, quantity: v.quantity, revenue: v.revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const dailyMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toLocaleDateString("ar-MA", { day: "2-digit", month: "2-digit" });
    dailyMap.set(key, 0);
  }
  for (const o of completed) {
    const d = new Date(o.updated_at);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays <= 6) {
      const key = d.toLocaleDateString("ar-MA", { day: "2-digit", month: "2-digit" });
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + o.total);
    }
  }
  const dailyRevenue = [...dailyMap.entries()].map(([day, revenue]) => ({ day, revenue }));

  return {
    revenueToday,
    revenueWeek,
    revenueMonth,
    revenueAllTime,
    ordersToday,
    completedOrders: completed.length,
    cancelledOrders,
    activeOrders,
    averageOrderValue,
    statusCounts,
    topProducts,
    dailyRevenue,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ar-MA", { dateStyle: "short", timeStyle: "short" });
}

/** تصدير تقرير المبيعات الكامل إلى PDF (ملخص KPI + أفضل المنتجات + جدول الطلبات). */
export async function exportDeliveryHubSalesPdf(
  store: Store,
  orders: Order[],
  report: SalesReport
): Promise<void> {
  const kpiRows: (string | number)[][] = [
    ["إجمالي المبيعات اليوم (DH)", report.revenueToday.toFixed(2)],
    ["إجمالي المبيعات هذا الأسبوع (DH)", report.revenueWeek.toFixed(2)],
    ["إجمالي المبيعات هذا الشهر (DH)", report.revenueMonth.toFixed(2)],
    ["إجمالي المبيعات الكلي (DH)", report.revenueAllTime.toFixed(2)],
    ["متوسط قيمة الطلب (DH)", report.averageOrderValue.toFixed(2)],
    ["الطلبات المكتملة", report.completedOrders],
    ["الطلبات النشطة (قيد المعالجة)", report.activeOrders],
    ["الطلبات الملغاة", report.cancelledOrders],
  ];
  const kpiTable = buildPdfTableHtml(["المؤشر", "القيمة"], kpiRows, "rtl");

  const topProductsTable =
    report.topProducts.length > 0
      ? buildPdfTableHtml(
          ["المنتج", "الكمية المباعة", "الإيراد (DH)"],
          report.topProducts.map((p) => [p.title, p.quantity, p.revenue.toFixed(2)]),
          "rtl"
        )
      : "<p style='text-align:center;color:#64748b;'>لا توجد مبيعات مكتملة بعد.</p>";

  const ordersTable =
    orders.length > 0
      ? buildPdfTableHtml(
          ["رقم الطلب", "الزبون", "الهاتف", "الحالة", "الإجمالي (DH)", "التاريخ"],
          orders
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((o) => [
              o.id.slice(0, 8),
              o.customer_name,
              o.customer_phone,
              ORDER_STATUS_LABELS[o.status] ?? o.status,
              o.total.toFixed(2),
              formatDate(o.created_at),
            ]),
          "rtl"
        )
      : "<p style='text-align:center;color:#64748b;'>لا توجد طلبات بعد.</p>";

  const inner = `
    <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin-bottom:12px;">${escapeHtmlPdf(store.name)} — تقرير المبيعات</h2>
    <h3 style="color:#0f172a;font-size:13px;font-weight:700;margin:16px 0 8px;">المؤشرات الرئيسية</h3>
    ${kpiTable}
    <h3 style="color:#0f172a;font-size:13px;font-weight:700;margin:16px 0 8px;">أفضل المنتجات مبيعاً</h3>
    ${topProductsTable}
    <h3 style="color:#0f172a;font-size:13px;font-weight:700;margin:16px 0 8px;">سجل الطلبات</h3>
    ${ordersTable}
  `;

  await exportSmartAlIdaraPdfPreferBackend({
    innerHtml: inner,
    sectionTitle: "تقرير مبيعات رادار الطلبات والتوصيل",
    fileName: `تقرير-مبيعات-${store.slug}`,
    direction: "rtl",
    lang: "ar",
    documentMode: "creative",
    mainTitle: store.name,
  });
}

/** تصدير تقرير المبيعات الكامل إلى Excel حقيقي (ExcelJS) بتنسيق ملون ومنظم. */
export async function exportDeliveryHubSalesExcel(
  store: Store,
  orders: Order[],
  report: SalesReport
): Promise<void> {
  await ensureExportLibrariesReady();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Smart Al-Idara Pro";
  wb.created = new Date();
  wb.modified = new Date();

  const summary = wb.addWorksheet("ملخص المبيعات", { views: [{ rightToLeft: true }] });
  summary.addRow([store.name, ""]);
  styleTitleRow(summary.getRow(1));
  summary.addRow(["المؤشر", "القيمة"]);
  styleHeaderRow(summary.getRow(2));
  const kpis: (string | number)[][] = [
    ["إجمالي المبيعات اليوم (DH)", Number(report.revenueToday.toFixed(2))],
    ["إجمالي المبيعات هذا الأسبوع (DH)", Number(report.revenueWeek.toFixed(2))],
    ["إجمالي المبيعات هذا الشهر (DH)", Number(report.revenueMonth.toFixed(2))],
    ["إجمالي المبيعات الكلي (DH)", Number(report.revenueAllTime.toFixed(2))],
    ["متوسط قيمة الطلب (DH)", Number(report.averageOrderValue.toFixed(2))],
    ["الطلبات المكتملة", report.completedOrders],
    ["الطلبات النشطة (قيد المعالجة)", report.activeOrders],
    ["الطلبات الملغاة", report.cancelledOrders],
  ];
  let r = 3;
  for (const row of kpis) {
    summary.addRow(row);
    styleDataRow(summary.getRow(r), r % 2 === 1);
    r++;
  }
  summary.getColumn(1).width = 36;
  summary.getColumn(2).width = 20;
  applyBordersToRange(summary, 1, r - 1, 1, 2);

  const productsSheet = wb.addWorksheet("أفضل المنتجات", { views: [{ rightToLeft: true }] });
  productsSheet.addRow(["المنتج", "الكمية المباعة", "الإيراد (DH)"]);
  styleHeaderRow(productsSheet.getRow(1));
  let pr = 2;
  for (const p of report.topProducts) {
    productsSheet.addRow([p.title, p.quantity, Number(p.revenue.toFixed(2))]);
    styleDataRow(productsSheet.getRow(pr), pr % 2 === 0);
    pr++;
  }
  productsSheet.getColumn(1).width = 30;
  productsSheet.getColumn(2).width = 18;
  productsSheet.getColumn(3).width = 18;
  applyBordersToRange(productsSheet, 1, Math.max(pr - 1, 1), 1, 3);

  const ordersSheet = wb.addWorksheet("سجل الطلبات", { views: [{ rightToLeft: true }] });
  ordersSheet.addRow(["رقم الطلب", "الزبون", "الهاتف", "الحالة", "الإجمالي (DH)", "التاريخ"]);
  styleHeaderRow(ordersSheet.getRow(1));
  const sortedOrders = orders
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  let or_ = 2;
  for (const o of sortedOrders) {
    ordersSheet.addRow([
      o.id.slice(0, 8),
      o.customer_name,
      o.customer_phone,
      ORDER_STATUS_LABELS[o.status] ?? o.status,
      Number(o.total.toFixed(2)),
      formatDate(o.created_at),
    ]);
    styleDataRow(ordersSheet.getRow(or_), or_ % 2 === 0);
    or_++;
  }
  ordersSheet.getColumn(1).width = 14;
  ordersSheet.getColumn(2).width = 22;
  ordersSheet.getColumn(3).width = 16;
  ordersSheet.getColumn(4).width = 18;
  ordersSheet.getColumn(5).width = 16;
  ordersSheet.getColumn(6).width = 20;
  applyBordersToRange(ordersSheet, 1, Math.max(or_ - 1, 1), 1, 6);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `تقرير-مبيعات-${store.slug}.xlsx`;
  a.style.setProperty("display", "none");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
