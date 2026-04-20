import type { TlIncident, TlOpsLog, TlVehicleLog } from "@/lib/tlApi";
import { exportTlErpPdf } from "@/pages/tl/tlPdfExport";

async function buildWorkbook(opts: {
  isVehicle: boolean;
  vehicles: TlVehicleLog[];
  ops: TlOpsLog[];
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.isVehicle ? "Vehicles" : "Ops");
  if (opts.isVehicle) {
    ws.columns = [
      { header: "Vehicle ID", key: "vid", width: 14 },
      { header: "Driver", key: "drv", width: 20 },
      { header: "Phone", key: "ph", width: 14 },
      { header: "Expected", key: "exp", width: 22 },
      { header: "Entry", key: "ent", width: 22 },
      { header: "Exit", key: "ex", width: 22 },
      { header: "Kind", key: "k", width: 8 },
      { header: "Pass/Seats or Cargo/Boxes", key: "extra", width: 28 },
      { header: "Delay min", key: "d", width: 10 },
      { header: "Status", key: "st", width: 10 },
    ];
    for (const r of opts.vehicles) {
      const extra =
        r.vehicle_kind === "bus"
          ? `P:${r.passenger_count ?? ""}/S:${r.seat_count ?? ""}`
          : `C:${r.cargo_count ?? ""}/B:${r.box_count ?? ""}`;
      ws.addRow({
        vid: r.vehicle_id,
        drv: r.driver_name,
        ph: r.driver_phone,
        exp: r.expected_entry_at,
        ent: r.entry_at ?? "",
        ex: r.exit_at ?? "",
        k: r.vehicle_kind,
        extra,
        d: r.delay_minutes,
        st: r.alert_level,
      });
    }
  } else {
    ws.columns = [
      { header: "Employee", key: "e", width: 22 },
      { header: "Time", key: "t", width: 22 },
      { header: "Qty", key: "q", width: 10 },
      { header: "Target %", key: "tg", width: 10 },
      { header: "Delay reason", key: "dr", width: 30 },
    ];
    for (const r of opts.ops) {
      ws.addRow({
        e: r.worker_full_name ?? r.worker_id,
        t: r.log_time,
        q: r.quantity,
        tg: r.target_pct,
        dr: r.delay_reason,
      });
    }
  }
  return wb;
}

export async function buildGridExcelFile(opts: {
  isVehicle: boolean;
  vehicles: TlVehicleLog[];
  ops: TlOpsLog[];
  deptLabel: string;
  fileBase: string;
}): Promise<File> {
  const wb = await buildWorkbook(opts);
  const buf = await wb.xlsx.writeBuffer();
  const name = `${opts.fileBase}-${opts.deptLabel.replace(/\W+/g, "_")}.xlsx`;
  return new File([buf], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function exportCurrentGridExcel(opts: {
  isVehicle: boolean;
  vehicles: TlVehicleLog[];
  ops: TlOpsLog[];
  deptLabel: string;
  fileBase: string;
}) {
  const wb = await buildWorkbook(opts);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = `${opts.fileBase}-${opts.deptLabel.replace(/\W+/g, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(u);
}

export async function exportCurrentGridPdf(opts: {
  direction: "rtl" | "ltr";
  lang: string;
  title: string;
  vehicles: TlVehicleLog[];
  ops: TlOpsLog[];
  incidents: TlIncident[];
  t: (k: string) => string;
  fileBase: string;
}) {
  await exportTlErpPdf({
    direction: opts.direction,
    lang: opts.lang,
    title: opts.title,
    vehicles: opts.vehicles,
    ops: opts.ops,
    incidents: opts.incidents,
    t: opts.t,
    fileName: `${opts.fileBase}-${Date.now()}.pdf`,
  });
}
