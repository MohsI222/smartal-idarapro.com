import ExcelJS from "exceljs";
import { db } from "./db.js";

const TL_VEHICLE_DEPTS = ["transport", "logistics"] as const;
const TL_OPS_DEPTS = ["production", "quality", "maintenance", "utilities"] as const;

function isVehicleDept(dept: string): boolean {
  return (TL_VEHICLE_DEPTS as readonly string[]).includes(dept);
}

function isKnownDept(dept: string): boolean {
  return (
    (TL_VEHICLE_DEPTS as readonly string[]).includes(dept) ||
    (TL_OPS_DEPTS as readonly string[]).includes(dept)
  );
}

/** يعيد Excel شبكة TL عند غياب الملف على القرص (مثلاً tl-grid-production.xlsx). */
export async function buildTlGridExcelBuffer(userId: string, deptSlug: string): Promise<Buffer | null> {
  const dept = deptSlug.trim().toLowerCase();
  if (!isKnownDept(dept)) return null;

  const wb = new ExcelJS.Workbook();
  const isVehicle = isVehicleDept(dept);
  const ws = wb.addWorksheet(isVehicle ? "Vehicles" : "Ops");

  if (isVehicle) {
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
    const rows = (await db
      .prepare(`SELECT * FROM tl_vehicle_logs WHERE user_id = ? AND department = ? ORDER BY created_at DESC`)
      .all(userId, dept)) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const kind = String(r.vehicle_kind ?? "");
      const extra =
        kind === "bus"
          ? `P:${r.passenger_count ?? ""}/S:${r.seat_count ?? ""}`
          : `C:${r.cargo_count ?? ""}/B:${r.box_count ?? ""}`;
      ws.addRow({
        vid: r.vehicle_id,
        drv: r.driver_name,
        ph: r.driver_phone,
        exp: r.expected_entry_at,
        ent: r.entry_at ?? "",
        ex: r.exit_at ?? "",
        k: kind,
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
    const rows = (await db
      .prepare(
        `SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o
         JOIN tl_workers w ON w.id = o.worker_id
         WHERE o.user_id = ? AND o.department = ?
         ORDER BY o.log_time DESC`
      )
      .all(userId, dept)) as Array<Record<string, unknown>>;
    for (const r of rows) {
      ws.addRow({
        e: r.worker_full_name ?? r.worker_id,
        t: r.log_time,
        q: r.quantity,
        tg: r.target_pct,
        dr: r.delay_reason,
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function parseTlGridDeptFromFilename(name: string): string | null {
  const m = /^tl-grid-([a-z_]+)\.xlsx$/i.exec(name.trim());
  return m?.[1]?.toLowerCase() ?? null;
}
