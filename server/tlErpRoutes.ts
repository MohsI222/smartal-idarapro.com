import type express from "express";
import path from "node:path";
import fs from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { db } from "./db.js";
import { paramString } from "./reqParams.js";
import { buildTlGridExcelBuffer, parseTlGridDeptFromFilename } from "./tlGridExport.js";

export type TlFilesConfig = {
  uploadTl: { single: (field: string) => express.RequestHandler };
  tlUploadRoot: string;
};

export const TL_VEHICLE_DEPTS = ["transport", "logistics"] as const;
export const TL_OPS_DEPTS = ["production", "quality", "maintenance", "utilities"] as const;
export type TlVehicleDept = (typeof TL_VEHICLE_DEPTS)[number];
export type TlOpsDept = (typeof TL_OPS_DEPTS)[number];

function isVehicleDept(d: string): d is TlVehicleDept {
  return (TL_VEHICLE_DEPTS as readonly string[]).includes(d);
}
function isOpsDept(d: string): d is TlOpsDept {
  return (TL_OPS_DEPTS as readonly string[]).includes(d);
}

type RowWorker = {
  id: string;
  user_id: string;
  full_name: string;
  employee_id: string;
  center: string;
  role_title: string;
  department: string;
  hierarchy_role: string;
  reports_to_worker_id: string | null;
  magic_token: string | null;
  created_at: string;
};

export function computeVehicleAlert(expectedIso: string, entryIso: string | null): {
  alert_level: "none" | "green" | "orange" | "red";
  delay_minutes: number;
} {
  if (!entryIso) return { alert_level: "none", delay_minutes: 0 };
  const exp = new Date(expectedIso).getTime();
  const ent = new Date(entryIso).getTime();
  if (!Number.isFinite(exp) || !Number.isFinite(ent)) {
    return { alert_level: "none", delay_minutes: 0 };
  }
  const delayMin = Math.floor((ent - exp) / 60_000);
  if (delayMin <= 0) return { alert_level: "green", delay_minutes: 0 };
  if (delayMin < 10) return { alert_level: "orange", delay_minutes: delayMin };
  return { alert_level: "red", delay_minutes: delayMin };
}

async function maybeCreateIncident(
  userId: string,
  refId: string,
  severity: "orange" | "red",
  summary: string,
  detail: string
): Promise<void> {
  const row = (await db
    .prepare(
      `SELECT id FROM tl_incidents WHERE user_id = ? AND ref_kind = 'vehicle' AND ref_id = ? AND severity = ?`
    )
    .get(userId, refId, severity)) as { id: string } | undefined;
  if (row) return;
  await db.prepare(
    `INSERT INTO tl_incidents (id, user_id, ref_kind, ref_id, severity, summary, detail) VALUES (?, ?, 'vehicle', ?, ?, ?, ?)`
  ).run(randomUUID(), userId, refId, severity, summary, detail);
}

async function recalcVehicleRow(
  userId: string,
  logId: string,
  data: {
    expected_entry_at: string;
    entry_at: string | null;
    marked_success: number;
  }
): Promise<void> {
  const { alert_level, delay_minutes } = computeVehicleAlert(data.expected_entry_at, data.entry_at);
  /** بعد «نجاح الدخول» تُعرض الحالة خضراء في الجدول، مع الإبقاء على دقائق التأخير للتقرير */
  const level = data.marked_success ? "green" : alert_level;
  await db.prepare(
    `UPDATE tl_vehicle_logs SET alert_level = ?, delay_minutes = ? WHERE id = ? AND user_id = ?`
  ).run(level, delay_minutes, logId, userId);

  if (data.entry_at && !data.marked_success) {
    if (alert_level === "orange") {
      await maybeCreateIncident(
        userId,
        logId,
        "orange",
        "تأخير دخول (1–9 دقائق)",
        `التأخير: ${delay_minutes} دقيقة`
      );
    } else if (alert_level === "red") {
      await maybeCreateIncident(
        userId,
        logId,
        "red",
        "تجاوز الحد الزمني (10 دقائق فأكثر)",
        `التأخير: ${delay_minutes} دقيقة`
      );
    }
  }
}

function messageTargetsFor(from: RowWorker, all: RowWorker[]): string[] {
  const ids = new Set<string>();
  if (from.reports_to_worker_id) ids.add(from.reports_to_worker_id);
  for (const w of all) {
    if (w.reports_to_worker_id === from.id) ids.add(w.id);
  }
  /** مدير / موارد بشرية / مشرف: نفس القسم + كل موظفي الموارد البشرية والمشرفين */
  if (["manager", "hr", "admin"].includes(from.hierarchy_role)) {
    for (const w of all) {
      const sameDept = w.department === from.department;
      const hrSide = w.hierarchy_role === "hr" || w.hierarchy_role === "admin";
      if (sameDept || hrSide) ids.add(w.id);
    }
  }
  return [...ids];
}

export function registerTlErpRoutes(
  app: express.Application,
  authMiddleware: express.RequestHandler,
  moduleAllowed: (userId: string, mod: string) => Promise<boolean>,
  files?: TlFilesConfig
) {
  const gate: express.RequestHandler = async (req, res, next) => {
    const uid = (req as express.Request & { userId: string }).userId;
    if (!(await moduleAllowed(uid, "transport_logistics"))) {
      res.status(403).json({ error: "وحدة النقل واللوجستيك غير مفعّلة في اشتراكك" });
      return;
    }
    next();
  };

  const authGate = [authMiddleware, gate] as express.RequestHandler[];

  const attachmentAccess: express.RequestHandler = async (req, res, next) => {
    const uid = (req as express.Request & { userId: string }).userId;
    const hasTl = await moduleAllowed(uid, "transport_logistics");
    const hasInv = await moduleAllowed(uid, "inventory");
    if (!hasTl && !hasInv) {
      res.status(403).json({ error: "القسم غير مفعّل" });
      return;
    }
    next();
  };

  // GET /api/tl/standalone-validate - Validate magic token for standalone access (public, no auth)
  app.get("/api/tl/standalone-validate", async (req, res) => {
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const token = String((req.query.token as string) ?? "").trim();
    console.log("[TL Standalone Validate] Token:", token);
    
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    
    try {
      const w = await db
        .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
        .get(token) as RowWorker | undefined;
      
      console.log("[TL Standalone Validate] Worker found:", !!w);
      
      if (!w) {
        // Return list of all workers for debugging
        const allWorkers = await db
          .prepare(`SELECT id, full_name, employee_id, magic_token FROM tl_workers LIMIT 5`)
          .all() as RowWorker[];
        console.log("[TL Standalone Validate] Available workers:", allWorkers);
        res.status(404).json({ 
          error: "not_found", 
          message: "Worker not found with this magic token",
          available_workers: allWorkers
        });
        return;
      }
      res.json({ success: true, worker: w });
    } catch (error) {
      console.error("[TL Standalone Validate] Error:", error);
      res.status(500).json({ error: "server_error", message: String(error) });
    }
  });

  // GET /api/tl/standalone-employees - Get employees for standalone access (public, token-based)
  app.get("/api/tl/standalone-employees", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const workers = await db
      .prepare(`SELECT * FROM tl_workers WHERE user_id = ? ORDER BY department, full_name`)
      .all(w.user_id) as RowWorker[];
    res.json({ success: true, workers });
  });

  // GET /api/tl/standalone-vehicles - Get vehicles for standalone access (public, token-based)
  app.get("/api/tl/standalone-vehicles", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const { token, department } = req.query as { token?: string; department?: string };
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    
    // Get vehicles for the department - filter by worker_id to show only this worker's vehicles
    const logs = await db
      .prepare(`SELECT * FROM tl_vehicle_logs
                WHERE user_id = ? AND department = ? AND worker_id = ?
                ORDER BY created_at DESC`)
      .all(w.user_id, department || w.department, w.id) as any[];
    
    res.json({ success: true, logs: logs || [] });
  });

  // POST /api/tl/standalone-vehicles - Create vehicle log for standalone access (public, token-based)
  app.post("/api/tl/standalone-vehicles", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token, department, vehicle_id, driver_name, driver_phone, driver_id_doc, vehicle_kind,
            expected_entry_at, entry_at, exit_at, passenger_count, seat_count, cargo_count, box_count,
            marked_success, notes, worker_id } = req.body as {
      token?: string; department?: string; vehicle_id?: string; driver_name?: string; driver_phone?: string;
      driver_id_doc?: string; vehicle_kind?: string; expected_entry_at?: string; entry_at?: string;
      exit_at?: string; passenger_count?: number; seat_count?: number; cargo_count?: number;
      box_count?: number; marked_success?: boolean; notes?: string; worker_id?: string;
    };

    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (!vehicle_id || !driver_name || !driver_phone) {
      res.status(400).json({ error: "missing_required_fields" });
      return;
    }

    try {
      const id = randomUUID();
      const vKind = String(vehicle_kind ?? "truck") === "bus" ? "bus" : "truck";
      const expectedEntry = expected_entry_at || new Date().toISOString();
      const entry = entry_at || null;
      const exit = exit_at || null;
      const success = marked_success ? 1 : 0;

      await db.prepare(
        `INSERT INTO tl_vehicle_logs (
          id, user_id, department, worker_id, vehicle_id, driver_name, driver_phone, driver_id_doc, vehicle_kind,
          expected_entry_at, entry_at, exit_at, passenger_count, seat_count, cargo_count, box_count,
          marked_success, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        w.user_id,
        department || w.department,
        worker_id || w.id,
        String(vehicle_id).trim(),
        String(driver_name).trim(),
        String(driver_phone).trim(),
        String(driver_id_doc ?? "").trim(),
        vKind,
        String(expectedEntry),
        entry,
        exit,
        passenger_count != null ? Number(passenger_count) : null,
        seat_count != null ? Number(seat_count) : null,
        cargo_count != null ? Number(cargo_count) : null,
        box_count != null ? Number(box_count) : null,
        success,
        notes != null ? String(notes) : null
      );

      // Recalculate alert level
      await recalcVehicleRow(w.user_id, id, {
        expected_entry_at: expectedEntry,
        entry_at: entry,
        marked_success: success,
      });

      const row = await db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id);
      res.json({ success: true, log: row });
    } catch (error) {
      console.error("[standalone-vehicles POST] Error:", error);
      res.status(500).json({ error: "server_error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /api/tl/standalone-items - Get logistics items for standalone access (public, token-based)
  app.get("/api/tl/standalone-items", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token, department } = req.query as { token?: string; department?: string };
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    console.log("[standalone-items] user_id:", w.user_id, "worker_id:", w.id, "department:", department || w.department);

    try {
      // Query actual logistics operations from tl_ops_logs table
      // Filter by user_id, department, AND worker_id to show only this worker's operations
      const targetDept = department || w.department;
      const items = await db
        .prepare(`SELECT o.*, w.full_name as worker_full_name
                  FROM tl_ops_logs o
                  JOIN tl_workers w ON w.id = o.worker_id
                  WHERE o.user_id = ? AND o.department = ? AND o.worker_id = ?
                  ORDER BY o.log_time DESC`)
        .all(w.user_id, targetDept, w.id) as any[];

      console.log("[standalone-items] items count:", items?.length || 0);

      res.json({ success: true, items: items || [] });
    } catch (error) {
      console.error("[standalone-items] Error:", error);
      res.status(500).json({ error: "server_error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // POST /api/tl/standalone-item-status - Update item status for standalone access (public, token-based)
  app.post("/api/tl/standalone-item-status", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const { token, item_id, status } = req.body as { token?: string; item_id?: string; status?: string };
    if (!token || !item_id || !status) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    
    // In production, this would update the actual logistics queue
    res.json({ success: true, message: "Status updated" });
  });

  // POST /api/tl/standalone-ops - Create production/ops log for standalone access (public, token-based)
  app.post("/api/tl/standalone-ops", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token, worker_id, log_time, quantity, delay_reason, target_pct, department } = req.body as {
      token?: string;
      worker_id?: string;
      log_time?: string;
      quantity?: number;
      delay_reason?: string;
      target_pct?: number;
      department?: string;
    };

    if (!token || !worker_id) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }

    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Verify worker belongs to the same user
    const worker = await db
      .prepare(`SELECT id FROM tl_workers WHERE id = ? AND user_id = ?`)
      .get(worker_id, w.user_id) as { id: string } | undefined;
    if (!worker) {
      res.status(400).json({ error: "worker_not_found" });
      return;
    }

    const id = randomUUID();
    await db.prepare(
      `INSERT INTO tl_ops_logs (id, user_id, department, worker_id, log_time, quantity, delay_reason, target_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      w.user_id,
      department || w.department,
      worker_id,
      log_time || new Date().toISOString(),
      Number(quantity ?? 0),
      String(delay_reason ?? ""),
      Math.min(100, Math.max(0, Number(target_pct ?? 100)))
    );

    console.log("[standalone-ops] Saved log id:", id, "user_id:", w.user_id, "department:", department || w.department);

    const row = await db
      .prepare(`SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o JOIN tl_workers w ON w.id = o.worker_id WHERE o.id = ?`)
      .get(id);
    res.json({ success: true, log: row });
  });

  // GET /api/tl/standalone-recipients - Get message recipients for standalone access (public, token-based)
  app.get("/api/tl/standalone-recipients", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Get all workers for the same user as potential recipients
    const recipients = await db
      .prepare(`SELECT id, full_name, employee_id, department FROM tl_workers WHERE user_id = ? AND id != ? ORDER BY full_name`)
      .all(w.user_id, w.id) as any[];

    res.json({ success: true, recipients: recipients || [] });
  });

  app.get("/api/tl/resolve-magic", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const token = String((req.query.token as string) ?? "").trim();
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE user_id = ? AND magic_token = ?`)
      .get(userId, token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ worker: w });
  });

  app.get("/api/tl/workers", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const dept = (req.query.department as string) || "";
    const q = dept
      ? await db.prepare(`SELECT * FROM tl_workers WHERE user_id = ? AND department = ? ORDER BY full_name`).all(userId, dept)
      : await db.prepare(`SELECT * FROM tl_workers WHERE user_id = ? ORDER BY department, full_name`).all(userId);
    res.json({ workers: q });
  });

  app.post("/api/tl/workers", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const b = req.body as Partial<RowWorker>;
    if (!b.full_name?.trim() || !b.employee_id?.trim() || !b.department?.trim()) {
      res.status(400).json({ error: "بيانات ناقصة" });
      return;
    }
    try {
      const id = randomUUID();
      const magic = randomBytes(18).toString("hex");
      await db.prepare(
        `INSERT INTO tl_workers (id, user_id, full_name, employee_id, center, role_title, department, hierarchy_role, reports_to_worker_id, magic_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        userId,
        b.full_name.trim(),
        b.employee_id.trim(),
        String(b.center ?? "").trim(),
        String(b.role_title ?? "").trim(),
        b.department.trim(),
        String(b.hierarchy_role ?? "employee").trim() || "employee",
        b.reports_to_worker_id?.trim() || null,
        magic
      );
      const row = await db.prepare(`SELECT * FROM tl_workers WHERE id = ?`).get(id) as RowWorker;
      res.json({ worker: row });
    } catch (error: any) {
      console.error("Error creating TL worker:", error);
      res.status(500).json({ error: "فشل إنشاء العامل: " + (error.message || "Database error") });
    }
  });

  app.patch("/api/tl/workers/:id", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = paramString(req.params.id);
    const b = req.body as Partial<RowWorker>;
    const cur = await db.prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`).get(id, userId) as RowWorker | undefined;
    if (!cur) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    await db.prepare(
      `UPDATE tl_workers SET full_name = ?, employee_id = ?, center = ?, role_title = ?, department = ?, hierarchy_role = ?, reports_to_worker_id = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      (b.full_name ?? cur.full_name).trim(),
      (b.employee_id ?? cur.employee_id).trim(),
      String(b.center ?? cur.center).trim(),
      String(b.role_title ?? cur.role_title).trim(),
      (b.department ?? cur.department).trim(),
      String(b.hierarchy_role ?? cur.hierarchy_role).trim(),
      b.reports_to_worker_id !== undefined ? b.reports_to_worker_id?.trim() || null : cur.reports_to_worker_id,
      id,
      userId
    );
    const row = await db.prepare(`SELECT * FROM tl_workers WHERE id = ?`).get(id) as RowWorker;
    res.json({ worker: row });
  });

  app.post("/api/tl/workers/:id/regenerate-magic", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = paramString(req.params.id);
    const magic = randomBytes(18).toString("hex");
    const r = await db.prepare(`UPDATE tl_workers SET magic_token = ? WHERE id = ? AND user_id = ?`).run(magic, id, userId);
    if (r.changes === 0) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    const row = await db.prepare(`SELECT * FROM tl_workers WHERE id = ?`).get(id) as RowWorker;
    res.json({ worker: row, magic_token: magic });
  });

  app.delete("/api/tl/workers/:id", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    await db.prepare(`DELETE FROM tl_workers WHERE id = ? AND user_id = ?`).run(paramString(req.params.id), userId);
    res.json({ ok: true });
  });

  app.get("/api/tl/vehicles", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const department = String(req.query.department ?? "");
    if (!isVehicleDept(department)) {
      res.status(400).json({ error: "department_invalid" });
      return;
    }
    const rows = await db
      .prepare(
        `SELECT * FROM tl_vehicle_logs WHERE user_id = ? AND department = ? ORDER BY expected_entry_at DESC`
      )
      .all(userId, department);
    res.json({ logs: rows });
  });

  app.post("/api/tl/vehicles", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const b = req.body as Record<string, unknown>;
    const department = String(b.department ?? "");
    if (!isVehicleDept(department)) {
      res.status(400).json({ error: "department_invalid" });
      return;
    }
    if (!b.vehicle_id || !String(b.vehicle_id).trim()) {
      res.status(400).json({ error: "vehicle_id_required" });
      return;
    }
    const id = randomUUID();
    const vehicle_kind = String(b.vehicle_kind ?? "truck") === "bus" ? "bus" : "truck";
    const expected_entry_at =
      b.expected_entry_at != null && String(b.expected_entry_at).trim() !== ""
        ? String(b.expected_entry_at)
        : new Date().toISOString();
    const entry_at = b.entry_at ? String(b.entry_at) : null;
    const marked_success = b.marked_success ? 1 : 0;
    await db.prepare(
      `INSERT INTO tl_vehicle_logs (
        id, user_id, department, worker_id, vehicle_id, driver_name, driver_phone, driver_id_doc, vehicle_kind,
        expected_entry_at, entry_at, exit_at, passenger_count, seat_count, cargo_count, box_count,
        marked_success, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      department,
      b.worker_id || null,
      String(b.vehicle_id).trim(),
      String(b.driver_name).trim(),
      String(b.driver_phone).trim(),
      String(b.driver_id_doc ?? "").trim(),
      vehicle_kind,
      String(b.expected_entry_at ?? new Date().toISOString()),
      entry_at,
      b.exit_at ? String(b.exit_at) : null,
      b.passenger_count != null ? Number(b.passenger_count) : null,
      b.seat_count != null ? Number(b.seat_count) : null,
      b.cargo_count != null ? Number(b.cargo_count) : null,
      b.box_count != null ? Number(b.box_count) : null,
      marked_success,
      b.notes != null ? String(b.notes) : null
    );
    await recalcVehicleRow(userId, id, {
      expected_entry_at,
      entry_at,
      marked_success,
    });
    const row = await db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id);
    res.json({ log: row });
  });

  app.patch("/api/tl/vehicles/:id", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = paramString(req.params.id);
    const cur = await db
      .prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ? AND user_id = ?`)
      .get(id, userId) as Record<string, unknown> | undefined;
    if (!cur) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const vehicle_kind =
      b.vehicle_kind !== undefined
        ? String(b.vehicle_kind) === "bus"
          ? "bus"
          : "truck"
        : String(cur.vehicle_kind);
    await db.prepare(
      `UPDATE tl_vehicle_logs SET
        vehicle_id = ?, driver_name = ?, driver_phone = ?, driver_id_doc = ?, vehicle_kind = ?,
        expected_entry_at = ?, entry_at = ?, exit_at = ?, passenger_count = ?, seat_count = ?,
        cargo_count = ?, box_count = ?, marked_success = ?, notes = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      b.vehicle_id !== undefined ? String(b.vehicle_id).trim() : String(cur.vehicle_id),
      b.driver_name !== undefined ? String(b.driver_name).trim() : String(cur.driver_name),
      b.driver_phone !== undefined ? String(b.driver_phone).trim() : String(cur.driver_phone),
      b.driver_id_doc !== undefined ? String(b.driver_id_doc).trim() : String(cur.driver_id_doc ?? ""),
      vehicle_kind,
      b.expected_entry_at !== undefined ? String(b.expected_entry_at) : String(cur.expected_entry_at),
      b.entry_at !== undefined ? (b.entry_at ? String(b.entry_at) : null) : (cur.entry_at as string | null),
      b.exit_at !== undefined ? (b.exit_at ? String(b.exit_at) : null) : (cur.exit_at as string | null),
      b.passenger_count !== undefined ? (b.passenger_count == null ? null : Number(b.passenger_count)) : (cur.passenger_count as number | null),
      b.seat_count !== undefined ? (b.seat_count == null ? null : Number(b.seat_count)) : (cur.seat_count as number | null),
      b.cargo_count !== undefined ? (b.cargo_count == null ? null : Number(b.cargo_count)) : (cur.cargo_count as number | null),
      b.box_count !== undefined ? (b.box_count == null ? null : Number(b.box_count)) : (cur.box_count as number | null),
      b.marked_success !== undefined ? (b.marked_success ? 1 : 0) : Number(cur.marked_success),
      b.notes !== undefined ? (b.notes == null ? null : String(b.notes)) : (cur.notes as string | null),
      id,
      userId
    );
    const updated = await db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id) as {
      expected_entry_at: string;
      entry_at: string | null;
      marked_success: number;
    };
    await recalcVehicleRow(userId, id, updated);
    const row = await db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id);
    res.json({ log: row });
  });

  app.delete("/api/tl/vehicles/:id", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    await db.prepare(`DELETE FROM tl_vehicle_logs WHERE id = ? AND user_id = ?`).run(paramString(req.params.id), userId);
    res.json({ ok: true });
  });

  app.get("/api/tl/ops", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const department = String(req.query.department ?? "");
    if (!isOpsDept(department)) {
      res.status(400).json({ error: "department_invalid" });
      return;
    }
    const rows = await db
      .prepare(
        `SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o
         JOIN tl_workers w ON w.id = o.worker_id
         WHERE o.user_id = ? AND o.department = ? ORDER BY o.log_time DESC`
      )
      .all(userId, department);
    res.json({ logs: rows });
  });

  app.post("/api/tl/ops", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const b = req.body as Record<string, unknown>;
    const department = String(b.department ?? "");
    if (!isOpsDept(department)) {
      res.status(400).json({ error: "department_invalid" });
      return;
    }
    const worker_id = String(b.worker_id ?? "");
    const wk = await db.prepare(`SELECT id FROM tl_workers WHERE id = ? AND user_id = ? AND department = ?`).get(worker_id, userId, department);
    if (!wk) {
      res.status(400).json({ error: "الموظف غير موجود في هذا القسم" });
      return;
    }
    const id = randomUUID();
    await db.prepare(
      `INSERT INTO tl_ops_logs (id, user_id, department, worker_id, log_time, quantity, delay_reason, target_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      department,
      worker_id,
      String(b.log_time ?? new Date().toISOString()),
      Number(b.quantity ?? 0),
      String(b.delay_reason ?? ""),
      Math.min(100, Math.max(0, Number(b.target_pct ?? 100)))
    );
    const row = await db
      .prepare(`SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o JOIN tl_workers w ON w.id = o.worker_id WHERE o.id = ?`)
      .get(id);
    res.json({ log: row });
  });

  app.patch("/api/tl/ops/:id", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = paramString(req.params.id);
    const cur = await db.prepare(`SELECT * FROM tl_ops_logs WHERE id = ? AND user_id = ?`).get(id, userId) as Record<string, unknown> | undefined;
    if (!cur) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    const b = req.body as Record<string, unknown>;
    await db.prepare(
      `UPDATE tl_ops_logs SET log_time = ?, quantity = ?, delay_reason = ?, target_pct = ? WHERE id = ? AND user_id = ?`
    ).run(
      b.log_time !== undefined ? String(b.log_time) : String(cur.log_time),
      b.quantity !== undefined ? Number(b.quantity) : Number(cur.quantity),
      b.delay_reason !== undefined ? String(b.delay_reason) : String(cur.delay_reason),
      b.target_pct !== undefined ? Math.min(100, Math.max(0, Number(b.target_pct))) : Number(cur.target_pct),
      id,
      userId
    );
    const row = await db
      .prepare(`SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o JOIN tl_workers w ON w.id = o.worker_id WHERE o.id = ?`)
      .get(id);
    res.json({ log: row });
  });

  app.delete("/api/tl/ops/:id", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    await db.prepare(`DELETE FROM tl_ops_logs WHERE id = ? AND user_id = ?`).run(paramString(req.params.id), userId);
    res.json({ ok: true });
  });

  // DELETE /api/tl/standalone-ops/:id - Delete operation log for standalone access (public, token-based)
  app.delete("/api/tl/standalone-ops/:id", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ error: "missing_token" });
      return;
    }

    // Verify magic token and get worker info
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    console.log("[standalone-ops DELETE] user_id:", w.user_id, "worker_id:", w.id, "log_id:", req.params.id);

    try {
      // Delete only if it belongs to this worker
      const result = await db
        .prepare(`DELETE FROM tl_ops_logs WHERE id = ? AND user_id = ? AND worker_id = ?`)
        .run(req.params.id, w.user_id, w.id);

      console.log("[standalone-ops DELETE] deleted rows:", result.changes);

      if (result.changes === 0) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("[standalone-ops DELETE] Error:", error);
      res.status(500).json({ error: "server_error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // DELETE /api/tl/standalone-ops/bulk - Bulk delete operation logs for standalone access
  app.delete("/api/tl/standalone-ops/bulk", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token, ids } = req.body as { token?: string; ids?: string[] };
    if (!token || !ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "missing_fields" });
      return;
    }

    // Verify magic token and get worker info
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    console.log("[standalone-ops BULK DELETE] user_id:", w.user_id, "worker_id:", w.id, "ids:", ids);

    try {
      // Delete only if they belong to this worker
      const placeholders = ids.map(() => '?').join(',');
      const result = await db
        .prepare(`DELETE FROM tl_ops_logs WHERE id IN (${placeholders}) AND user_id = ? AND worker_id = ?`)
        .run(...ids, w.user_id, w.id);

      console.log("[standalone-ops BULK DELETE] deleted rows:", result.changes);

      res.json({ ok: true, deleted: result.changes });
    } catch (error) {
      console.error("[standalone-ops BULK DELETE] Error:", error);
      res.status(500).json({ error: "server_error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // DELETE /api/tl/standalone-vehicles/:id - Delete vehicle log for standalone access (public, token-based)
  app.delete("/api/tl/standalone-vehicles/:id", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    try {
      const id = paramString(req.params.id);
      await db.prepare(`DELETE FROM tl_vehicle_logs WHERE id = ? AND user_id = ? AND worker_id = ?`).run(id, w.user_id, w.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("[standalone-vehicles DELETE] Error:", error);
      res.status(500).json({ error: "server_error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // POST /api/tl/standalone-vehicles/:id/success - Toggle vehicle success for standalone access (public, token-based)
  app.post("/api/tl/standalone-vehicles/:id/success", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    try {
      const id = paramString(req.params.id);
      const { marked_success } = req.body as { marked_success?: boolean };
      const newSuccess = marked_success ? 1 : 0;

      await db.prepare(`UPDATE tl_vehicle_logs SET marked_success = ? WHERE id = ? AND user_id = ? AND worker_id = ?`).run(newSuccess, id, w.user_id, w.id);

      // Recalculate alert level
      const row = await db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id) as any;
      if (row) {
        await recalcVehicleRow(w.user_id, id, row);
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("[standalone-vehicles SUCCESS] Error:", error);
      res.status(500).json({ error: "server_error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // DELETE /api/tl/standalone-vehicles/bulk - Bulk delete vehicle logs for standalone access (public, token-based)
  app.delete("/api/tl/standalone-vehicles/bulk", async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { token, ids } = req.body as { token?: string; ids?: string[] };
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids_required" });
      return;
    }
    const w = await db
      .prepare(`SELECT * FROM tl_workers WHERE magic_token = ?`)
      .get(token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      const result = await db.prepare(
        `DELETE FROM tl_vehicle_logs WHERE id IN (${placeholders}) AND user_id = ? AND worker_id = ?`
      ).run(...ids, w.user_id, w.id);

      console.log("[standalone-vehicles BULK DELETE] deleted rows:", result.changes);

      res.json({ ok: true, deleted: result.changes });
    } catch (error) {
      console.error("[standalone-vehicles BULK DELETE] Error:", error);
      res.status(500).json({ error: "server_error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/tl/incidents", ...authGate, async (_req, res) => {
    const userId = (_req as express.Request & { userId: string }).userId;
    const rows = await db
      .prepare(`SELECT * FROM tl_incidents WHERE user_id = ? ORDER BY created_at DESC`)
      .all(userId);
    res.json({ incidents: rows });
  });

  app.delete("/api/tl/incidents/:id", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    await db.prepare(`DELETE FROM tl_incidents WHERE id = ? AND user_id = ?`).run(paramString(req.params.id), userId);
    res.json({ ok: true });
  });

  app.get("/api/tl/messages", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const workerId = String(req.query.worker_id ?? "");
    if (!workerId) {
      res.status(400).json({ error: "worker_id_required" });
      return;
    }
    const wk = await db.prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`).get(workerId, userId) as RowWorker | undefined;
    if (!wk) {
      res.status(404).json({ error: "worker_not_found" });
      return;
    }
    const all = await db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
    const allowed = new Set(messageTargetsFor(wk, all));
    const inbox = await db
      .prepare(
        `SELECT m.*, fw.full_name as from_name, tw.full_name as to_name FROM tl_messages m
         JOIN tl_workers fw ON fw.id = m.from_worker_id
         JOIN tl_workers tw ON tw.id = m.to_worker_id
         WHERE m.user_id = ? AND (m.to_worker_id = ? OR m.from_worker_id = ?)
         ORDER BY m.created_at DESC`
      )
      .all(userId, workerId, workerId);
    res.json({ messages: inbox, allowedRecipientIds: [...allowed] });
  });

  app.get("/api/tl/messages/eligible/:fromWorkerId", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const fromWorkerId = paramString(req.params.fromWorkerId);
    const wk = await db.prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`).get(fromWorkerId, userId) as RowWorker | undefined;
    if (!wk) {
      res.status(404).json({ error: "worker_not_found" });
      return;
    }
    const all = await db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
    const ids = messageTargetsFor(wk, all);
    if (ids.length === 0) {
      res.json({ recipients: [] });
      return;
    }
    const ph = ids.map(() => "?").join(",");
    const people = await db
      .prepare(`SELECT id, full_name, hierarchy_role, department FROM tl_workers WHERE user_id = ? AND id IN (${ph})`)
      .all(userId, ...ids);
    res.json({ recipients: people });
  });

  app.post("/api/tl/messages", ...authGate, async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const b = req.body as { from_worker_id?: string; to_worker_id?: string; body?: string };
    if (!b.from_worker_id || !b.to_worker_id || !b.body?.trim()) {
      res.status(400).json({ error: "بيانات ناقصة" });
      return;
    }
    const from = await db
      .prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`)
      .get(b.from_worker_id, userId) as RowWorker | undefined;
    if (!from) {
      res.status(404).json({ error: "from_not_found" });
      return;
    }
    const to = await db.prepare(`SELECT id FROM tl_workers WHERE id = ? AND user_id = ?`).get(b.to_worker_id, userId);
    if (!to) {
      res.status(404).json({ error: "to_not_found" });
      return;
    }
    const all = await db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
    const allowed = messageTargetsFor(from, all);
    if (!allowed.includes(b.to_worker_id)) {
      res.status(403).json({ error: "لا يمكن الإرسال خارج سلسلة الإدارية المسموحة" });
      return;
    }
    const id = randomUUID();
    await db.prepare(
      `INSERT INTO tl_messages (id, user_id, from_worker_id, to_worker_id, body) VALUES (?, ?, ?, ?, ?)`
    ).run(id, userId, b.from_worker_id, b.to_worker_id, b.body.trim());
    const row = await db
      .prepare(
        `SELECT m.*, fw.full_name as from_name, tw.full_name as to_name FROM tl_messages m
         JOIN tl_workers fw ON fw.id = m.from_worker_id
         JOIN tl_workers tw ON tw.id = m.to_worker_id WHERE m.id = ?`
      )
      .get(id);
    res.json({ message: row });
  });

  if (files?.uploadTl && files.tlUploadRoot) {
    const runMulter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      files!.uploadTl.single("file")(req, res, (err: unknown) => {
        if (err) {
          res.status(400).json({ error: "رفع الملف فشل أو النوع غير مسموح (PDF / Excel / CSV / Image)" });
          return;
        }
        next();
      });
    };

    app.post(
      "/api/tl/messages/with-attachment",
      ...authGate,
      runMulter,
      async (req, res) => {
        const userId = (req as express.Request & { userId: string }).userId;
        const file = (req as express.Request & { file?: Express.Multer.File }).file;
        const body = (req.body as { from_worker_id?: string; to_worker_id?: string; body?: string }) ?? {};
        const textBody = String(body.body ?? "").trim() || (file ? "📎" : "");
        if (!body.from_worker_id || !body.to_worker_id || (!file && !textBody.trim())) {
          if (file?.path) {
            try {
              fs.unlinkSync(file.path);
            } catch {
              /* ignore */
            }
          }
          res.status(400).json({ error: "بيانات ناقصة" });
          return;
        }
        if (!file) {
          res.status(400).json({ error: "ملف ناقص" });
          return;
        }
        const from = await db
          .prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`)
          .get(body.from_worker_id, userId) as RowWorker | undefined;
        if (!from) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            /* ignore */
          }
          res.status(404).json({ error: "from_not_found" });
          return;
        }
        const to = await db.prepare(`SELECT id FROM tl_workers WHERE id = ? AND user_id = ?`).get(body.to_worker_id, userId);
        if (!to) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            /* ignore */
          }
          res.status(404).json({ error: "to_not_found" });
          return;
        }
        const all = await db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
        const allowed = messageTargetsFor(from, all);
        if (!allowed.includes(body.to_worker_id)) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            /* ignore */
          }
          res.status(403).json({ error: "لا يمكن الإرسال خارج سلسلة الإدارية المسموحة" });
          return;
        }
        const safeDiskName = path.basename(file.filename || file.path);
        const id = randomUUID();
        const original = file.originalname || "attachment";
        const mime = file.mimetype || "application/octet-stream";
        let fileBuffer: Buffer | null = null;
        try {
          fileBuffer = fs.readFileSync(file.path);
        } catch {
          fileBuffer = null;
        }
        await db.prepare(
          `INSERT INTO tl_messages (id, user_id, from_worker_id, to_worker_id, body, attachment_original_name, attachment_stored_path, attachment_mime, attachment_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          userId,
          body.from_worker_id,
          body.to_worker_id,
          textBody || "📎",
          original,
          safeDiskName,
          mime,
          fileBuffer
        );
        const row = await db
          .prepare(
            `SELECT m.*, fw.full_name as from_name, tw.full_name as to_name FROM tl_messages m
             JOIN tl_workers fw ON fw.id = m.from_worker_id
             JOIN tl_workers tw ON tw.id = m.to_worker_id WHERE m.id = ?`
          )
          .get(id);
        res.json({ message: row });
      }
    );

    app.get("/api/tl/messages/:id/attachment", authMiddleware, attachmentAccess, async (req, res) => {
      const userId = (req as express.Request & { userId: string }).userId;
      const id = paramString(req.params.id);
      const row = await db
        .prepare(`SELECT * FROM tl_messages WHERE id = ? AND user_id = ?`)
        .get(id, userId) as {
        attachment_stored_path: string | null;
        attachment_original_name: string | null;
        attachment_mime: string | null;
        attachment_data: Buffer | null;
      } | undefined;
      if (!row?.attachment_stored_path && !row?.attachment_data) {
        res.status(404).json({ error: "no_file" });
        return;
      }
      const fname = row.attachment_original_name || "file";
      const mime = row.attachment_mime || "application/octet-stream";
      const encodedName = encodeURIComponent(fname);

      if (row.attachment_stored_path && files?.tlUploadRoot) {
        const tlRoot = files.tlUploadRoot;
        const safeName = path.basename(row.attachment_stored_path);
        const full = path.join(tlRoot, safeName);
        const resolvedRoot = path.resolve(tlRoot);
        const resolvedFile = path.resolve(full);
        if (
          (resolvedFile.startsWith(resolvedRoot + path.sep) || resolvedFile === resolvedRoot) &&
          fs.existsSync(resolvedFile)
        ) {
          res.setHeader("Content-Type", mime);
          res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`);
          res.sendFile(resolvedFile);
          return;
        }
      }

      if (row.attachment_data && row.attachment_data.length > 0) {
        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`);
        res.send(row.attachment_data);
        return;
      }

      const gridDept = parseTlGridDeptFromFilename(fname);
      if (gridDept) {
        const regenerated = await buildTlGridExcelBuffer(userId, gridDept);
        if (regenerated) {
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`);
          res.send(regenerated);
          return;
        }
      }

      res.status(404).json({ error: "attachment_not_found" });
    });
  }
}
