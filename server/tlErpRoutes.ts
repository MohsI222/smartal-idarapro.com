import type express from "express";
import path from "node:path";
import fs from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { db } from "./db.js";

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

function maybeCreateIncident(
  userId: string,
  refId: string,
  severity: "orange" | "red",
  summary: string,
  detail: string
) {
  const row = db
    .prepare(
      `SELECT id FROM tl_incidents WHERE user_id = ? AND ref_kind = 'vehicle' AND ref_id = ? AND severity = ?`
    )
    .get(userId, refId, severity) as { id: string } | undefined;
  if (row) return;
  db.prepare(
    `INSERT INTO tl_incidents (id, user_id, ref_kind, ref_id, severity, summary, detail) VALUES (?, ?, 'vehicle', ?, ?, ?, ?)`
  ).run(randomUUID(), userId, refId, severity, summary, detail);
}

function recalcVehicleRow(userId: string, logId: string, data: {
  expected_entry_at: string;
  entry_at: string | null;
  marked_success: number;
}) {
  const { alert_level, delay_minutes } = computeVehicleAlert(data.expected_entry_at, data.entry_at);
  /** بعد «نجاح الدخول» تُعرض الحالة خضراء في الجدول، مع الإبقاء على دقائق التأخير للتقرير */
  const level = data.marked_success ? "green" : alert_level;
  db.prepare(
    `UPDATE tl_vehicle_logs SET alert_level = ?, delay_minutes = ? WHERE id = ? AND user_id = ?`
  ).run(level, delay_minutes, logId, userId);

  if (data.entry_at && !data.marked_success) {
    if (alert_level === "orange") {
      maybeCreateIncident(
        userId,
        logId,
        "orange",
        "تأخير دخول (1–9 دقائق)",
        `التأخير: ${delay_minutes} دقيقة`
      );
    } else if (alert_level === "red") {
      maybeCreateIncident(
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
  moduleAllowed: (userId: string, mod: string) => boolean,
  files?: TlFilesConfig
) {
  const gate: express.RequestHandler = (req, res, next) => {
    const uid = (req as express.Request & { userId: string }).userId;
    if (!moduleAllowed(uid, "transport_logistics")) {
      res.status(403).json({ error: "وحدة النقل واللوجستيك غير مفعّلة في اشتراكك" });
      return;
    }
    next();
  };

  const authGate = [authMiddleware, gate] as express.RequestHandler[];

  app.get("/api/tl/resolve-magic", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const token = String((req.query.token as string) ?? "").trim();
    if (!token) {
      res.status(400).json({ error: "token_required" });
      return;
    }
    const w = db
      .prepare(`SELECT * FROM tl_workers WHERE user_id = ? AND magic_token = ?`)
      .get(userId, token) as RowWorker | undefined;
    if (!w) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ worker: w });
  });

  app.get("/api/tl/workers", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const dept = (req.query.department as string) || "";
    const q = dept
      ? db.prepare(`SELECT * FROM tl_workers WHERE user_id = ? AND department = ? ORDER BY full_name`).all(userId, dept)
      : db.prepare(`SELECT * FROM tl_workers WHERE user_id = ? ORDER BY department, full_name`).all(userId);
    res.json({ workers: q });
  });

  app.post("/api/tl/workers", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const b = req.body as Partial<RowWorker>;
    if (!b.full_name?.trim() || !b.employee_id?.trim() || !b.department?.trim()) {
      res.status(400).json({ error: "بيانات ناقصة" });
      return;
    }
    const id = randomUUID();
    const magic = randomBytes(18).toString("hex");
    db.prepare(
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
    const row = db.prepare(`SELECT * FROM tl_workers WHERE id = ?`).get(id) as RowWorker;
    res.json({ worker: row });
  });

  app.patch("/api/tl/workers/:id", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = req.params.id;
    const b = req.body as Partial<RowWorker>;
    const cur = db.prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`).get(id, userId) as RowWorker | undefined;
    if (!cur) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    db.prepare(
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
    const row = db.prepare(`SELECT * FROM tl_workers WHERE id = ?`).get(id) as RowWorker;
    res.json({ worker: row });
  });

  app.post("/api/tl/workers/:id/regenerate-magic", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = req.params.id;
    const magic = randomBytes(18).toString("hex");
    const r = db.prepare(`UPDATE tl_workers SET magic_token = ? WHERE id = ? AND user_id = ?`).run(magic, id, userId);
    if (r.changes === 0) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    const row = db.prepare(`SELECT * FROM tl_workers WHERE id = ?`).get(id) as RowWorker;
    res.json({ worker: row, magic_token: magic });
  });

  app.delete("/api/tl/workers/:id", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    db.prepare(`DELETE FROM tl_workers WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
    res.json({ ok: true });
  });

  app.get("/api/tl/vehicles", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const department = String(req.query.department ?? "");
    if (!isVehicleDept(department)) {
      res.status(400).json({ error: "department_invalid" });
      return;
    }
    const rows = db
      .prepare(
        `SELECT * FROM tl_vehicle_logs WHERE user_id = ? AND department = ? ORDER BY datetime(expected_entry_at) DESC`
      )
      .all(userId, department);
    res.json({ logs: rows });
  });

  app.post("/api/tl/vehicles", ...authGate, (req, res) => {
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
    db.prepare(
      `INSERT INTO tl_vehicle_logs (
        id, user_id, department, vehicle_id, driver_name, driver_phone, driver_id_doc, vehicle_kind,
        expected_entry_at, entry_at, exit_at, passenger_count, seat_count, cargo_count, box_count,
        marked_success, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      department,
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
    recalcVehicleRow(userId, id, {
      expected_entry_at,
      entry_at,
      marked_success,
    });
    const row = db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id);
    res.json({ log: row });
  });

  app.patch("/api/tl/vehicles/:id", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = req.params.id;
    const cur = db
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
    db.prepare(
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
    const updated = db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id) as {
      expected_entry_at: string;
      entry_at: string | null;
      marked_success: number;
    };
    recalcVehicleRow(userId, id, updated);
    const row = db.prepare(`SELECT * FROM tl_vehicle_logs WHERE id = ?`).get(id);
    res.json({ log: row });
  });

  app.delete("/api/tl/vehicles/:id", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    db.prepare(`DELETE FROM tl_vehicle_logs WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
    res.json({ ok: true });
  });

  app.get("/api/tl/ops", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const department = String(req.query.department ?? "");
    if (!isOpsDept(department)) {
      res.status(400).json({ error: "department_invalid" });
      return;
    }
    const rows = db
      .prepare(
        `SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o
         JOIN tl_workers w ON w.id = o.worker_id
         WHERE o.user_id = ? AND o.department = ? ORDER BY datetime(o.log_time) DESC`
      )
      .all(userId, department);
    res.json({ logs: rows });
  });

  app.post("/api/tl/ops", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const b = req.body as Record<string, unknown>;
    const department = String(b.department ?? "");
    if (!isOpsDept(department)) {
      res.status(400).json({ error: "department_invalid" });
      return;
    }
    const worker_id = String(b.worker_id ?? "");
    const wk = db.prepare(`SELECT id FROM tl_workers WHERE id = ? AND user_id = ? AND department = ?`).get(worker_id, userId, department);
    if (!wk) {
      res.status(400).json({ error: "الموظف غير موجود في هذا القسم" });
      return;
    }
    const id = randomUUID();
    db.prepare(
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
    const row = db
      .prepare(`SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o JOIN tl_workers w ON w.id = o.worker_id WHERE o.id = ?`)
      .get(id);
    res.json({ log: row });
  });

  app.patch("/api/tl/ops/:id", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const id = req.params.id;
    const cur = db.prepare(`SELECT * FROM tl_ops_logs WHERE id = ? AND user_id = ?`).get(id, userId) as Record<string, unknown> | undefined;
    if (!cur) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    const b = req.body as Record<string, unknown>;
    db.prepare(
      `UPDATE tl_ops_logs SET log_time = ?, quantity = ?, delay_reason = ?, target_pct = ? WHERE id = ? AND user_id = ?`
    ).run(
      b.log_time !== undefined ? String(b.log_time) : String(cur.log_time),
      b.quantity !== undefined ? Number(b.quantity) : Number(cur.quantity),
      b.delay_reason !== undefined ? String(b.delay_reason) : String(cur.delay_reason),
      b.target_pct !== undefined ? Math.min(100, Math.max(0, Number(b.target_pct))) : Number(cur.target_pct),
      id,
      userId
    );
    const row = db
      .prepare(`SELECT o.*, w.full_name as worker_full_name FROM tl_ops_logs o JOIN tl_workers w ON w.id = o.worker_id WHERE o.id = ?`)
      .get(id);
    res.json({ log: row });
  });

  app.delete("/api/tl/ops/:id", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    db.prepare(`DELETE FROM tl_ops_logs WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
    res.json({ ok: true });
  });

  app.get("/api/tl/incidents", ...authGate, (_req, res) => {
    const userId = (_req as express.Request & { userId: string }).userId;
    const rows = db
      .prepare(`SELECT * FROM tl_incidents WHERE user_id = ? ORDER BY datetime(created_at) DESC`)
      .all(userId);
    res.json({ incidents: rows });
  });

  app.delete("/api/tl/incidents/:id", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    db.prepare(`DELETE FROM tl_incidents WHERE id = ? AND user_id = ?`).run(req.params.id, userId);
    res.json({ ok: true });
  });

  app.get("/api/tl/messages", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const workerId = String(req.query.worker_id ?? "");
    if (!workerId) {
      res.status(400).json({ error: "worker_id_required" });
      return;
    }
    const wk = db.prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`).get(workerId, userId) as RowWorker | undefined;
    if (!wk) {
      res.status(404).json({ error: "worker_not_found" });
      return;
    }
    const all = db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
    const allowed = new Set(messageTargetsFor(wk, all));
    const inbox = db
      .prepare(
        `SELECT m.*, fw.full_name as from_name, tw.full_name as to_name FROM tl_messages m
         JOIN tl_workers fw ON fw.id = m.from_worker_id
         JOIN tl_workers tw ON tw.id = m.to_worker_id
         WHERE m.user_id = ? AND (m.to_worker_id = ? OR m.from_worker_id = ?)
         ORDER BY datetime(m.created_at) DESC`
      )
      .all(userId, workerId, workerId);
    res.json({ messages: inbox, allowedRecipientIds: [...allowed] });
  });

  app.get("/api/tl/messages/eligible/:fromWorkerId", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const fromWorkerId = req.params.fromWorkerId;
    const wk = db.prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`).get(fromWorkerId, userId) as RowWorker | undefined;
    if (!wk) {
      res.status(404).json({ error: "worker_not_found" });
      return;
    }
    const all = db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
    const ids = messageTargetsFor(wk, all);
    if (ids.length === 0) {
      res.json({ recipients: [] });
      return;
    }
    const ph = ids.map(() => "?").join(",");
    const people = db
      .prepare(`SELECT id, full_name, hierarchy_role, department FROM tl_workers WHERE user_id = ? AND id IN (${ph})`)
      .all(userId, ...ids);
    res.json({ recipients: people });
  });

  app.post("/api/tl/messages", ...authGate, (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const b = req.body as { from_worker_id?: string; to_worker_id?: string; body?: string };
    if (!b.from_worker_id || !b.to_worker_id || !b.body?.trim()) {
      res.status(400).json({ error: "بيانات ناقصة" });
      return;
    }
    const from = db
      .prepare(`SELECT * FROM tl_workers WHERE id = ? AND user_id = ?`)
      .get(b.from_worker_id, userId) as RowWorker | undefined;
    if (!from) {
      res.status(404).json({ error: "from_not_found" });
      return;
    }
    const to = db.prepare(`SELECT id FROM tl_workers WHERE id = ? AND user_id = ?`).get(b.to_worker_id, userId);
    if (!to) {
      res.status(404).json({ error: "to_not_found" });
      return;
    }
    const all = db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
    const allowed = messageTargetsFor(from, all);
    if (!allowed.includes(b.to_worker_id)) {
      res.status(403).json({ error: "لا يمكن الإرسال خارج سلسلة الإدارية المسموحة" });
      return;
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO tl_messages (id, user_id, from_worker_id, to_worker_id, body) VALUES (?, ?, ?, ?, ?)`
    ).run(id, userId, b.from_worker_id, b.to_worker_id, b.body.trim());
    const row = db
      .prepare(
        `SELECT m.*, fw.full_name as from_name, tw.full_name as to_name FROM tl_messages m
         JOIN tl_workers fw ON fw.id = m.from_worker_id
         JOIN tl_workers tw ON tw.id = m.to_worker_id WHERE m.id = ?`
      )
      .get(id);
    res.json({ message: row });
  });

  if (files?.uploadTl && files.tlUploadRoot) {
    const tlRoot = path.resolve(files.tlUploadRoot);

    const runMulter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      files!.uploadTl.single("file")(req, res, (err: unknown) => {
        if (err) {
          res.status(400).json({ error: "رفع الملف فشل أو النوع غير مسموح (PDF / Excel / CSV)" });
          return;
        }
        next();
      });
    };

    app.post(
      "/api/tl/messages/with-attachment",
      ...authGate,
      runMulter,
      (req, res) => {
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
        const from = db
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
        const to = db.prepare(`SELECT id FROM tl_workers WHERE id = ? AND user_id = ?`).get(body.to_worker_id, userId);
        if (!to) {
          try {
            fs.unlinkSync(file.path);
          } catch {
            /* ignore */
          }
          res.status(404).json({ error: "to_not_found" });
          return;
        }
        const all = db.prepare(`SELECT * FROM tl_workers WHERE user_id = ?`).all(userId) as RowWorker[];
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
        db.prepare(
          `INSERT INTO tl_messages (id, user_id, from_worker_id, to_worker_id, body, attachment_original_name, attachment_stored_path, attachment_mime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          userId,
          body.from_worker_id,
          body.to_worker_id,
          textBody || "📎",
          original,
          safeDiskName,
          mime
        );
        const row = db
          .prepare(
            `SELECT m.*, fw.full_name as from_name, tw.full_name as to_name FROM tl_messages m
             JOIN tl_workers fw ON fw.id = m.from_worker_id
             JOIN tl_workers tw ON tw.id = m.to_worker_id WHERE m.id = ?`
          )
          .get(id);
        res.json({ message: row });
      }
    );

    app.get("/api/tl/messages/:id/attachment", authMiddleware, gate, (req, res) => {
      const userId = (req as express.Request & { userId: string }).userId;
      const id = req.params.id;
      const row = db
        .prepare(`SELECT * FROM tl_messages WHERE id = ? AND user_id = ?`)
        .get(id, userId) as {
        attachment_stored_path: string | null;
        attachment_original_name: string | null;
        attachment_mime: string | null;
        from_worker_id: string;
        to_worker_id: string;
      } | undefined;
      if (!row?.attachment_stored_path) {
        res.status(404).json({ error: "no_file" });
        return;
      }
      const safeName = path.basename(row.attachment_stored_path);
      const full = path.join(tlRoot, safeName);
      const resolvedRoot = path.resolve(tlRoot);
      const resolvedFile = path.resolve(full);
      if (
        !resolvedFile.startsWith(resolvedRoot + path.sep) &&
        resolvedFile !== resolvedRoot
      ) {
        res.status(400).end();
        return;
      }
      if (!fs.existsSync(resolvedFile)) {
        res.status(404).end();
        return;
      }
      const fname = row.attachment_original_name || "file";
      res.setHeader("Content-Type", row.attachment_mime || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(fname)}`);
      res.sendFile(resolvedFile);
    });
  }
}
