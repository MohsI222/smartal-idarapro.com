import express from "express";
import { db } from "./db";
import { authMiddleware } from "./index";

const router = express.Router();

interface ActivePerson {
  id: string;
  name: string;
  context: string;
  phone?: string;
  employeeId?: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  isOnline: boolean;
}

/**
 * Middleware to extract user_id and employee_id from magic-link token (for standalone endpoints)
 */
async function extractMagicUserId(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const { magic } = req.query as { magic?: string };
  if (magic) {
    try {
      const worker = await db
        .prepare(`SELECT id, user_id FROM tl_workers WHERE magic_token = ?`)
        .get(magic) as { id: string; user_id: string } | undefined;
      if (worker) {
        (req as any).magicUserId = worker.user_id;
        (req as any).magicEmployeeId = worker.id; // Use worker.id as employee_id
      }
    } catch (error) {
      console.error("[GPS] Error extracting magic user ID:", error);
    }
  }
  next();
}

/**
 * Middleware to extract user_id from POS agent token
 */
async function extractPosAgentUserId(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const { token } = req.query as { token?: string };
  if (token) {
    try {
      const tokenData = await db
        .prepare(`SELECT user_id, employee_id FROM pos_agent_tokens WHERE token = ? AND is_active = 1`)
        .get(token) as { user_id: string; employee_id: string } | undefined;
      if (tokenData) {
        (req as any).posAgentUserId = tokenData.user_id;
        (req as any).posAgentEmployeeId = tokenData.employee_id;
      }
    } catch (error) {
      console.error("[GPS] Error extracting POS agent user ID:", error);
    }
  }
  next();
}

/**
 * POST /api/gps/track
 * Receives GPS tracking data from client (background GPS)
 * Works with authenticated users, magic-link users, and public links (store/contract)
 * NO AUTHENTICATION REQUIRED for public links (store/contract)
 */
router.post("/track", extractMagicUserId, extractPosAgentUserId, async (req, res) => {
  try {
    console.log('[GPS] Received GPS request, body:', req.body);
    console.log('[GPS] Request headers:', req.headers.authorization ? 'Has Auth' : 'No Auth');

    const {
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      heading,
      timestamp,
      context,
      public_link_id,
      employee_id,
      phone_number,
    } = req.body as {
      latitude: number;
      longitude: number;
      accuracy?: number;
      altitude?: number | null;
      speed?: number | null;
      heading?: number | null;
      timestamp: number;
      context?: string;
      public_link_id?: string;
      employee_id?: string;
      phone_number?: string;
    };

    // Validate required fields
    if (!latitude || !longitude || !timestamp) {
      res.status(400).json({ error: "Missing required fields: latitude, longitude, timestamp" });
      return;
    }

    // Get user_id from request body (for public links) or from auth/magic/pos-agent
    // Priority: public_link_id > magicUserId > posAgentUserId > userId > Authorization header
    let userId = public_link_id || (req as any).magicUserId || (req as any).posAgentUserId || (req as any).userId;

    console.log('[GPS] Initial userId:', userId, 'public_link_id:', public_link_id, 'employee_id:', employee_id);

    // If still no userId, try to get from Authorization header as fallback
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const { verifyToken } = await import('./crypto');
          const payload = verifyToken(token);
          if (payload && payload.sub) {
            userId = payload.sub;
            console.log('[GPS] Got userId from token:', userId);
          }
        } catch (err) {
          console.error('[GPS] Failed to verify token:', err);
        }
      }
    }

    console.log('[GPS] Final userId:', userId);

    if (!userId) {
      console.error('[GPS] No userId found, returning 401');
      res.status(401).json({ error: "Unauthorized - no identifier provided" });
      return;
    }

    // Ensure table exists with BIGINT timestamp (no foreign key constraint)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS gps_tracking_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        employee_id TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        accuracy REAL,
        altitude REAL,
        speed REAL,
        heading REAL,
        timestamp BIGINT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Insert GPS log
    const id = crypto.randomUUID();
    const finalEmployeeId = employee_id || (req as any).magicEmployeeId || (req as any).posAgentEmployeeId || null;
    const phoneNumber = (req.body as any).phone_number || null;
    await db.prepare(`
      INSERT INTO gps_tracking_logs (id, user_id, employee_id, phone_number, latitude, longitude, accuracy, altitude, speed, heading, timestamp, context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      finalEmployeeId,
      phoneNumber,
      latitude,
      longitude,
      accuracy || null,
      altitude || null,
      speed || null,
      heading || null,
      timestamp,
      context || null
    );

    console.log(`[GPS] GPS tracked successfully for user_id: ${userId}, employee_id: ${finalEmployeeId}, context: ${context}, public_link_id: ${public_link_id}`);

    // Update user's last known location in users table (only for real users)
    try {
      await db.prepare(`
        UPDATE users SET last_latitude = ?, last_longitude = ?, last_gps_time = ?
        WHERE id = ?
      `).run(latitude, longitude, new Date(timestamp).toISOString(), userId);
    } catch (err) {
      // Ignore if columns don't exist yet or userId is a public link ID
    }

    res.json({ success: true, id });
  } catch (error) {
    console.error("[GPS] Error tracking GPS:", error);
    res.status(500).json({ error: "Failed to track GPS" });
  }
});

/**
 * GET /api/gps/latest
 * Get latest GPS location for current user (authenticated or magic-link)
 */
router.get("/latest", extractMagicUserId, async (req, res) => {
  try {
    const userId = (req as any).userId || (req as any).magicUserId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const latest = await db.prepare(`
      SELECT * FROM gps_tracking_logs
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(userId) as Record<string, unknown> | undefined;

    if (!latest) {
      res.json({ location: null });
      return;
    }

    res.json({ location: latest });
  } catch (error) {
    console.error("[GPS] Error getting latest GPS:", error);
    res.status(500).json({ error: "Failed to get latest GPS" });
  }
});

/**
 * GET /api/gps/user
 * Get GPS history for current authenticated user
 */
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const history = await db.prepare(`
      SELECT * FROM gps_tracking_logs
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 100
    `).all(userId) as Record<string, unknown>[];

    const latest = history.length > 0 ? history[0] : null;

    res.json({ history, latest });
  } catch (error) {
    console.error("[GPS] Error getting user GPS history:", error);
    res.status(500).json({ error: "Failed to get user GPS history" });
  }
});

/**
 * GET /api/gps/active-persons
 * Get list of active persons with their GPS status for current user (admin only)
 */
router.get("/active-persons", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Get all recent GPS points (last 30 minutes)
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const recentPoints = await db.prepare(`
      SELECT DISTINCT employee_id, phone_number, context, latitude, longitude, timestamp
      FROM gps_tracking_logs
      WHERE user_id = ? AND timestamp > ?
      ORDER BY timestamp DESC
    `).all(userId, thirtyMinutesAgo) as Record<string, unknown>[];

    // Get employees for this user
    const employees = await db.prepare(`
      SELECT id, employee_id, name
      FROM hr_employees
      WHERE user_id = ?
    `).all(userId) as Array<{
      id: string;
      employee_id: string;
      name: string;
    }>;

    // Get contract signers for this user
    let contractSigners: Array<{ signer_phone: string; signer_name: string }> = [];
    try {
      contractSigners = await db.prepare(`
        SELECT DISTINCT signer_phone, signer_name
        FROM contract_signatures
        WHERE contract_id IN (SELECT id FROM contracts WHERE user_id = ?)
      `).all(userId) as Array<{
        signer_phone: string;
        signer_name: string;
      }>;
    } catch (err) {
      console.log('[GPS] contract_signatures table may not exist or query failed:', err);
    }

    // Build active persons list
    const persons = new Map<string, ActivePerson>();

    for (const point of recentPoints) {
      const employeeId = point.employee_id as string;
      const phoneNumber = point.phone_number as string;
      const context = point.context as string;

      let personId = employeeId || phoneNumber || context;
      let personName = '';
      let personPhone = '';

      // Try to find employee
      if (employeeId) {
        const employee = employees.find(e => e.employee_id === employeeId);
        if (employee) {
          personName = employee.name;
        }
      } else if (phoneNumber) {
        personPhone = phoneNumber;
        // Try to find contract signer
        const signer = contractSigners.find(s => s.signer_phone === phoneNumber);
        if (signer) {
          personName = signer.signer_name || `موقع: ${phoneNumber}`;
        } else {
          personName = `العميل: ${phoneNumber}`;
        }
      } else {
        personName = context;
      }

      // Check if recently active (within 5 minutes)
      const isOnline = (point.timestamp as number) > (Date.now() - 5 * 60 * 1000);

      persons.set(personId, {
        id: personId,
        name: personName,
        context,
        phone: personPhone,
        employeeId,
        lastLocation: {
          latitude: point.latitude as number,
          longitude: point.longitude as number,
          timestamp: point.timestamp as number,
        },
        isOnline,
      });
    }

    res.json({ persons: Array.from(persons.values()) });
  } catch (error) {
    console.error("[GPS] Error getting active persons:", error);
    res.status(500).json({ error: "Failed to get active persons" });
  }
});

/**
 * GET /api/gps/latest
 * Get latest GPS location for current user (authenticated or magic-link)
 */
router.get("/latest", extractMagicUserId, async (req, res) => {
  try {
    const userId = (req as any).userId || (req as any).magicUserId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const latest = await db.prepare(`
      SELECT * FROM gps_tracking_logs
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(userId) as Record<string, unknown> | undefined;

    if (!latest) {
      res.json({ location: null });
      return;
    }

    res.json({ location: latest });
  } catch (error) {
    console.error("[GPS] Error getting latest GPS:", error);
    res.status(500).json({ error: "Failed to get latest GPS" });
  }
});

/**
 * GET /api/gps/worker/:workerId
 * Get latest GPS location for a specific worker (admin only)
 */
router.get("/worker/:workerId", authMiddleware, async (req, res) => {
  try {
    const adminUserId = (req as any).userId;
    const workerId = req.params.workerId;

    if (!adminUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Get worker info to verify same tenant
    const worker = await db.prepare(`
      SELECT id, user_id FROM tl_workers WHERE id = ?
    `).get(workerId) as { id: string; user_id: string } | undefined;

    if (!worker) {
      res.status(404).json({ error: "Worker not found" });
      return;
    }

    // Verify same tenant (user_id)
    if (worker.user_id !== adminUserId) {
      res.status(403).json({ error: "Forbidden - worker belongs to different tenant" });
      return;
    }

    // Search GPS by employee_id (worker.id) with tenant user_id for safety
    const latest = await db.prepare(`
      SELECT * FROM gps_tracking_logs
      WHERE employee_id = ? AND user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(worker.id, adminUserId) as Record<string, unknown> | undefined;

    if (!latest) {
      res.json({ location: null });
      return;
    }

    res.json({ location: latest });
  } catch (error) {
    console.error("[GPS] Error getting worker GPS:", error);
    res.status(500).json({ error: "Failed to get worker GPS" });
  }
});

/**
 * GET /api/gps/phone/:phoneNumber
 * Get latest GPS location for a specific phone number (delivery hub orders)
 */
router.get("/phone/:phoneNumber", authMiddleware, async (req, res) => {
  try {
    const adminUserId = (req as any).userId;
    const phoneNumber = req.params.phoneNumber;

    if (!adminUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!phoneNumber) {
      res.status(400).json({ error: "Missing phone number" });
      return;
    }

    // Search GPS by phone number with tenant user_id for safety
    const latest = await db.prepare(`
      SELECT * FROM gps_tracking_logs
      WHERE phone_number = ? AND user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(phoneNumber, adminUserId) as Record<string, unknown> | undefined;

    if (!latest) {
      res.json({ location: null });
      return;
    }

    res.json({ location: latest });
  } catch (error) {
    console.error("[GPS] Error getting phone GPS:", error);
    res.status(500).json({ error: "Failed to get phone GPS" });
  }
});

/**
 * DELETE /api/gps/delete
 * Delete a single GPS point (admin only)
 */
router.delete("/delete", authMiddleware, async (req, res) => {
  try {
    const adminUserId = (req as any).userId;
    const { id } = req.body as { id: string };

    if (!adminUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!id) {
      res.status(400).json({ error: "Missing point ID" });
      return;
    }

    // Verify the point belongs to the admin's tenant
    const point = await db.prepare(`
      SELECT user_id FROM gps_tracking_logs WHERE id = ?
    `).get(id) as { user_id: string } | undefined;

    if (!point) {
      res.status(404).json({ error: "Point not found" });
      return;
    }

    if (point.user_id !== adminUserId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.prepare(`DELETE FROM gps_tracking_logs WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (error) {
    console.error("[GPS] Error deleting GPS point:", error);
    res.status(500).json({ error: "Failed to delete GPS point" });
  }
});

/**
 * DELETE /api/gps/delete-all
 * Delete all GPS points for a specific identifier (admin only)
 */
router.delete("/delete-all", authMiddleware, async (req, res) => {
  try {
    const adminUserId = (req as any).userId;
    const { phone_number, worker_id, public_link_id } = req.body as {
      phone_number?: string;
      worker_id?: string;
      public_link_id?: string;
    };

    if (!adminUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!phone_number && !worker_id && !public_link_id) {
      res.status(400).json({ error: "Missing identifier" });
      return;
    }

    let query = "DELETE FROM gps_tracking_logs WHERE user_id = ?";
    const params: any[] = [adminUserId];

    if (phone_number) {
      query += " AND phone_number = ?";
      params.push(phone_number);
    }
    if (worker_id) {
      query += " AND employee_id = ?";
      params.push(worker_id);
    }
    if (public_link_id) {
      query += " AND public_link_id = ?";
      params.push(public_link_id);
    }

    await db.prepare(query).run(...params);
    res.json({ success: true });
  } catch (error) {
    console.error("[GPS] Error deleting all GPS points:", error);
    res.status(500).json({ error: "Failed to delete GPS points" });
  }
});

/**
 * GET /api/gps/history/:userId
 * Get GPS history for a specific user (public or admin)
 */
router.get("/history/:userId", async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    if (!targetUserId) {
      res.status(400).json({ error: "Missing user ID" });
      return;
    }

    const history = await db.prepare(`
      SELECT * FROM gps_tracking_logs
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 100
    `).all(targetUserId);

    res.json({ history });
  } catch (error) {
    console.error("[GPS] Error getting GPS history:", error);
    res.status(500).json({ error: "Failed to get GPS history" });
  }
});

/**
 * GET /api/gps/public/:publicLinkId
 * Get latest GPS location for a public link (store/contract) - admin only
 */
router.get("/public/:publicLinkId", authMiddleware, async (req, res) => {
  try {
    const adminUserId = (req as any).userId;
    const publicLinkId = req.params.publicLinkId;

    if (!adminUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const latest = await db.prepare(`
      SELECT * FROM gps_tracking_logs
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(publicLinkId) as Record<string, unknown> | undefined;

    if (!latest) {
      res.json({ location: null });
      return;
    }

    res.json({ location: latest });
  } catch (error) {
    console.error("[GPS] Error getting public link GPS:", error);
    res.status(500).json({ error: "Failed to get public link GPS" });
  }
});

export default router;
