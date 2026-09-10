import express from "express";
import { randomUUID } from "node:crypto";
import { db } from "./db";

const router = express.Router();

// Generate a secure random token
function generateSecureToken(): string {
  const uuid = randomUUID();
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${uuid}-${timestamp}-${random}`.replace(/-/g, "");
}

// POST /api/pos-agent/tokens - Create a new POS agent token
router.post("/tokens", async (req, res) => {
  try {
    const { employee_id, metadata } = req.body as {
      employee_id?: string;
      metadata?: Record<string, unknown>;
    };
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Generate unique token
    const token = generateSecureToken();
    
    // Set expiration to 30 days from now (optional)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Insert token
    const result = await db.prepare(
      `INSERT INTO pos_agent_tokens (id, token, user_id, employee_id, is_active, expires_at, metadata)
       VALUES (?, ?, ?, ?, true, ?, ?::jsonb)
       RETURNING id, token, employee_id, is_active, created_at, expires_at, metadata`
    ).get(randomUUID(), token, userId, employee_id || null, expiresAt, JSON.stringify(metadata || {}));

    res.json({
      success: true,
      token: result,
      link: `/pos-agent?token=${token}`
    });
  } catch (error) {
    console.error("[POS Agent] Error creating token:", error);
    res.status(500).json({ error: "Failed to create token" });
  }
});

// POST /api/pos-agent/generate-token - Generate a simple token for agent POS (no employee_id required)
router.post("/generate-token", async (req, res) => {
  try {
    const userId = (req as any).userId;

    console.log("[POS Agent] generate-token - userId:", userId);

    if (!userId) {
      console.log("[POS Agent] generate-token - Unauthorized: no userId");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Generate unique token
    const token = generateSecureToken();
    console.log("[POS Agent] generate-token - Generated token:", token);

    // Set expiration to 30 days from now
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Insert token without employee_id (employees select themselves on login)
    console.log("[POS Agent] generate-token - Inserting token into database...");
    const result = await db.prepare(
      `INSERT INTO pos_agent_tokens (id, token, user_id, employee_id, is_active, expires_at, metadata)
       VALUES (?, ?, ?, NULL, 1, ?, NULL)
       RETURNING token`
    ).get(randomUUID(), token, userId, expiresAt);

    console.log("[POS Agent] generate-token - Insert successful, result:", result);

    res.json({
      success: true,
      token: result?.token
    });
  } catch (error) {
    console.error("[POS Agent] Error generating token:", error);
    if (error instanceof Error) {
      console.error("[POS Agent] Error message:", error.message);
      console.error("[POS Agent] Error stack:", error.stack);
    }
    res.status(500).json({ error: "Failed to generate token", details: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/pos-agent/tokens - Get all tokens for the current user
router.get("/tokens", async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const tokens = await db.prepare(
      `SELECT id, token, employee_id, is_active, created_at, expires_at, last_used_at, metadata
       FROM pos_agent_tokens
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).all(userId);

    res.json({ success: true, tokens: tokens || [] });
  } catch (error) {
    console.error("[POS Agent] Error fetching tokens:", error);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// PUT /api/pos-agent/tokens/:id/revoke - Revoke a token
router.put("/tokens/:id/revoke", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await db.prepare(
      `UPDATE pos_agent_tokens
       SET is_active = 0
       WHERE id = ? AND user_id = ?
       RETURNING id`
    ).get(id, userId);

    if (!result) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    res.json({ success: true, message: "Token revoked successfully" });
  } catch (error) {
    console.error("[POS Agent] Error revoking token:", error);
    res.status(500).json({ error: "Failed to revoke token" });
  }
});

// PUT /api/pos-agent/tokens/:id/rotate - Rotate (regenerate) a token
router.put("/tokens/:id/rotate", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Generate new token
    const newToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.prepare(
      `UPDATE pos_agent_tokens
       SET token = ?, is_active = 1, expires_at = ?, last_used_at = NULL
       WHERE id = ? AND user_id = ?
       RETURNING id, token, employee_id, is_active, created_at, expires_at`
    ).get(newToken, expiresAt, id, userId);

    if (!result) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    res.json({
      success: true,
      token: result,
      link: `/pos-agent?token=${newToken}`,
      message: "Token rotated successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error rotating token:", error);
    res.status(500).json({ error: "Failed to rotate token" });
  }
});

// DELETE /api/pos-agent/tokens/:id - Delete a token
router.delete("/tokens/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await db.prepare(
      `DELETE FROM pos_agent_tokens
       WHERE id = ? AND user_id = ?
       RETURNING id`
    ).get(id, userId);

    if (!result) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    res.json({ success: true, message: "Token deleted successfully" });
  } catch (error) {
    console.error("[POS Agent] Error deleting token:", error);
    res.status(500).json({ error: "Failed to delete token" });
  }
});

// GET /api/pos-agent/validate/:token - Validate a token (public endpoint, no auth required)
router.get("/validate/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const tokenData = await db.prepare(
      `SELECT id, user_id, employee_id, is_active, expires_at, last_used_at, metadata
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Update last_used_at
    await db.prepare(
      `UPDATE pos_agent_tokens
       SET last_used_at = NOW()
       WHERE id = ?`
    ).run(tokenData.id);

    res.json({
      success: true,
      valid: true,
      employee_id: tokenData.employee_id,
      metadata: tokenData.metadata
    });
  } catch (error) {
    console.error("[POS Agent] Error validating token:", error);
    res.status(500).json({ error: "Failed to validate token" });
  }
});

// GET /api/pos-agent/employees - Get available employees for POS agent selection
// This endpoint needs auth middleware to get userId
router.get("/employees", async (req, res) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const employees = await db.prepare(
      `SELECT id, employee_id, name, role
       FROM hr_employees
       WHERE user_id = ?
       ORDER BY name ASC`
    ).all(userId);

    res.json({ success: true, employees: employees || [] });
  } catch (error) {
    console.error("[POS Agent] Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// POST /api/pos-agent/session - Create or update agent session
router.post("/session", async (req, res) => {
  try {
    const { token, employee_id } = req.body as {
      token?: string;
      employee_id?: string;
    };
    console.log("[POS Agent] /session request:", { token: token?.substring(0, 20), employee_id });

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    console.log("[POS Agent] Token data:", tokenData);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Update token with selected employee_id
    await db.prepare(
      `UPDATE pos_agent_tokens
       SET employee_id = ?, last_used_at = NOW()
       WHERE id = ?`
    ).run(employee_id, tokenData.id);

    // Get employee details from tl_workers (same table as standalone-employees)
    const employee = await db.prepare(
      `SELECT id, employee_id, full_name as name, role_title as role, department
       FROM tl_workers
       WHERE employee_id = ? AND user_id = ?`
    ).get(employee_id, tokenData.user_id);

    console.log("[POS Agent] Employee found:", employee);

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    res.json({
      success: true,
      employee,
      message: "Session created successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// POST /api/pos-agent/sales - Create a new sale
router.post("/sales", async (req, res) => {
  try {
    const { token, employee_id, customer_name, lines, total_amount, paid_amount, credit_amount, payment_method } = req.body as {
      token?: string;
      employee_id?: string;
      customer_name?: string;
      lines?: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>;
      total_amount?: number;
      paid_amount?: number;
      credit_amount?: number;
      payment_method?: string;
    };

    if (!token || !employee_id || !lines || lines.length === 0) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    const saleId = randomUUID();

    // Insert sale
    await db.prepare(
      `INSERT INTO pos_agent_sales (id, user_id, employee_id, customer_name, total_amount, paid_amount, credit_amount, payment_method, sale_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`
    ).run(saleId, tokenData.user_id, employee_id, customer_name || "عميل نقدي", total_amount, paid_amount, credit_amount, payment_method || "cash");

    // Insert sale lines and update inventory
    for (const line of lines) {
      const lineId = randomUUID();
      await db.prepare(
        `INSERT INTO pos_agent_sales_lines (id, sale_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(lineId, saleId, line.product_id, line.product_name, line.quantity, line.unit_price, line.line_total);

      // Update inventory stock
      await db.prepare(
        `UPDATE inventory_products
         SET stock_pieces = stock_pieces - ?
         WHERE id = ? AND user_id = ?`
      ).run(line.quantity, line.product_id, tokenData.user_id);
    }

    // Get the created sale
    const sale = await db.prepare(
      `SELECT * FROM pos_agent_sales WHERE id = ?`
    ).get(saleId);

    res.json({
      success: true,
      sale,
      message: "Sale created successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error creating sale:", error);
    res.status(500).json({ error: "Failed to create sale" });
  }
});

// GET /api/pos-agent/sales - Get sales for the current agent
router.get("/sales", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    // Validate token and get employee_id
    const tokenData = await db.prepare(
      `SELECT id, user_id, employee_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    if (!tokenData.employee_id) {
      res.status(400).json({ error: "No employee associated with this token" });
      return;
    }

    // Get sales with lines
    const sales = await db.prepare(
      `SELECT * FROM pos_agent_sales
       WHERE employee_id = ?
       ORDER BY sale_date DESC`
    ).all(tokenData.employee_id);

    // Get lines for each sale
    const salesWithLines = await Promise.all(
      sales.map(async (sale: any) => {
        const lines = await db.prepare(
          `SELECT * FROM pos_agent_sales_lines WHERE sale_id = ?`
        ).all(sale.id);
        return { ...sale, lines };
      })
    );

    res.json({ success: true, sales: salesWithLines });
  } catch (error) {
    console.error("[POS Agent] Error fetching sales:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// POST /api/pos-agent/attendance/clock-in - Clock in
router.post("/attendance/clock-in", async (req, res) => {
  try {
    const { token, employee_id } = req.body as {
      token?: string;
      employee_id?: string;
    };

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Check if already clocked in today
    const existingAttendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance
       WHERE employee_id = ? AND DATE(clock_in_time) = CURRENT_DATE AND clock_out_time IS NULL`
    ).get(employee_id);

    if (existingAttendance) {
      res.status(400).json({ error: "Already clocked in today" });
      return;
    }

    const attendanceId = randomUUID();

    // Insert attendance record
    await db.prepare(
      `INSERT INTO pos_agent_attendance (id, user_id, employee_id, clock_in_time)
       VALUES (?, ?, ?, NOW())`
    ).run(attendanceId, tokenData.user_id, employee_id);

    const attendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance WHERE id = ?`
    ).get(attendanceId);

    res.json({
      success: true,
      attendance,
      message: "Clocked in successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error clocking in:", error);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// POST /api/pos-agent/attendance/clock-out - Clock out
router.post("/attendance/clock-out", async (req, res) => {
  try {
    const { token, employee_id } = req.body as {
      token?: string;
      employee_id?: string;
    };

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Get today's attendance record
    const attendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance
       WHERE employee_id = ? AND DATE(clock_in_time) = CURRENT_DATE AND clock_out_time IS NULL`
    ).get(employee_id);

    if (!attendance) {
      res.status(400).json({ error: "No active clock-in found for today" });
      return;
    }

    // Update clock_out_time and calculate duration
    await db.prepare(
      `UPDATE pos_agent_attendance
       SET clock_out_time = NOW(),
           work_duration_minutes = EXTRACT(EPOCH FROM (NOW() - clock_in_time)) / 60
       WHERE id = ?`
    ).run(attendance.id);

    const updatedAttendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance WHERE id = ?`
    ).get(attendance.id);

    res.json({
      success: true,
      attendance: updatedAttendance,
      message: "Clocked out successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error clocking out:", error);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// GET /api/pos-agent/attendance - Get today's attendance
router.get("/attendance", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    // Validate token and get employee_id
    const tokenData = await db.prepare(
      `SELECT id, user_id, employee_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    if (!tokenData.employee_id) {
      res.status(400).json({ error: "No employee associated with this token" });
      return;
    }

    // Get today's attendance
    const attendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance
       WHERE employee_id = ? AND DATE(clock_in_time) = CURRENT_DATE`
    ).get(tokenData.employee_id);

    res.json({ success: true, attendance: attendance || null });
  } catch (error) {
    console.error("[POS Agent] Error fetching attendance:", error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// GET /api/pos-agent/standalone-employees - Get TL employees for standalone POS (public, token-based)
router.get("/standalone-employees", async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Load TL workers (transport and logistics)
    const employees = await db.prepare(
      `SELECT id, employee_id as employee_id, full_name as name, role_title as role, department
       FROM tl_workers
       WHERE user_id = ? AND (department = 'transport' OR department = 'logistics')
       ORDER BY full_name ASC`
    ).all(tokenData.user_id);

    res.json({ success: true, employees: employees || [] });
  } catch (error) {
    console.error("[POS Agent] Error fetching standalone employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// GET /api/pos-agent/standalone-sales - Get sales for standalone POS (public, token-based)
router.get("/standalone-sales", async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id } = req.query as { token?: string; employee_id?: string };
    console.log("[POS Agent] /standalone-sales request:", { token: token?.substring(0, 20), employee_id });

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    console.log("[POS Agent] Token data:", tokenData);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Get sales
    const sales = await db.prepare(
      `SELECT * FROM pos_agent_sales
       WHERE employee_id = ?
       ORDER BY sale_date DESC`
    ).all(employee_id);

    console.log("[POS Agent] Sales found:", sales);

    // Get all lines for these sales in a single query
    const saleIds = sales.map((s: any) => s.id);
    let lines: any[] = [];
    if (saleIds.length > 0) {
      const placeholders = saleIds.map(() => '?').join(',');
      lines = await db.prepare(
        `SELECT * FROM pos_agent_sales_lines WHERE sale_id IN (${placeholders})`
      ).all(...saleIds);
    }

    console.log("[POS Agent] Lines found:", lines);

    // Group lines by sale_id
    const linesBySaleId = lines.reduce((acc: any, line: any) => {
      if (!acc[line.sale_id]) {
        acc[line.sale_id] = [];
      }
      acc[line.sale_id].push(line);
      return acc;
    }, {});

    // Attach lines to sales
    const salesWithLines = sales.map((sale: any) => ({
      ...sale,
      lines: linesBySaleId[sale.id] || []
    }));

    console.log("[POS Agent] Sales with lines:", salesWithLines);
    res.json({ success: true, sales: salesWithLines });
  } catch (error) {
    console.error("[POS Agent] Error fetching standalone sales:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// POST /api/pos-agent/standalone-sales - Create sale for standalone POS (public, token-based)
router.post("/standalone-sales", async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const { token, employee_id, customer_name, lines, total_amount, paid_amount, credit_amount, payment_method } = req.body as {
      token?: string;
      employee_id?: string;
      customer_name?: string;
      lines?: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>;
      total_amount?: number;
      paid_amount?: number;
      credit_amount?: number;
      payment_method?: string;
    };

    if (!token || !employee_id || !lines || lines.length === 0) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    const saleId = randomUUID();

    // Insert sale
    await db.prepare(
      `INSERT INTO pos_agent_sales (id, user_id, employee_id, customer_name, total_amount, paid_amount, credit_amount, payment_method, sale_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`
    ).run(saleId, tokenData.user_id, employee_id, customer_name || "عميل نقدي", total_amount, paid_amount, credit_amount, payment_method || "cash");

    // Insert sale lines and update inventory
    for (const line of lines) {
      const lineId = randomUUID();
      await db.prepare(
        `INSERT INTO pos_agent_sales_lines (id, sale_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(lineId, saleId, line.product_id, line.product_name, line.quantity, line.unit_price, line.line_total);

      // Update inventory stock
      const updateResult = await db.prepare(
        `UPDATE inventory_products
         SET stock_pieces = stock_pieces - ?
         WHERE id = ? AND user_id = ?`
      ).run(line.quantity, line.product_id, tokenData.user_id);
      
      console.log("[POS Agent] Stock update result:", { productId: line.product_id, quantity: line.quantity, changes: updateResult.changes });
    }

    // Get the created sale
    const sale = await db.prepare(
      `SELECT * FROM pos_agent_sales WHERE id = ?`
    ).get(saleId);

    res.json({
      success: true,
      sale,
      message: "Sale created successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error creating standalone sale:", error);
    res.status(500).json({ error: "Failed to create sale" });
  }
});

// GET /api/pos-agent/standalone-attendance - Get attendance for standalone POS (public, token-based)
router.get("/standalone-attendance", async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const { token, employee_id } = req.query as { token?: string; employee_id?: string };

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Get today's attendance
    const attendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance
       WHERE employee_id = ? AND DATE(clock_in_time) = CURRENT_DATE`
    ).get(employee_id);

    res.json({ success: true, attendance: attendance || null });
  } catch (error) {
    console.error("[POS Agent] Error fetching standalone attendance:", error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// POST /api/pos-agent/standalone-attendance/clock-in - Clock in for standalone POS (public, token-based)
router.post("/standalone-attendance/clock-in", async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const { token, employee_id } = req.body as {
      token?: string;
      employee_id?: string;
    };

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Check if already clocked in today
    const existingAttendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance
       WHERE employee_id = ? AND DATE(clock_in_time) = CURRENT_DATE AND clock_out_time IS NULL`
    ).get(employee_id);

    if (existingAttendance) {
      res.status(400).json({ error: "Already clocked in today" });
      return;
    }

    const attendanceId = randomUUID();

    // Insert attendance record
    await db.prepare(
      `INSERT INTO pos_agent_attendance (id, user_id, employee_id, clock_in_time)
       VALUES (?, ?, ?, NOW())`
    ).run(attendanceId, tokenData.user_id, employee_id);

    const attendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance WHERE id = ?`
    ).get(attendanceId);

    res.json({
      success: true,
      attendance,
      message: "Clocked in successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error clocking in:", error);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// POST /api/pos-agent/standalone-attendance/clock-out - Clock out for standalone POS (public, token-based)
router.post("/standalone-attendance/clock-out", async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  try {
    const { token, employee_id } = req.body as {
      token?: string;
      employee_id?: string;
    };

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Get today's attendance record
    const attendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance
       WHERE employee_id = ? AND DATE(clock_in_time) = CURRENT_DATE AND clock_out_time IS NULL`
    ).get(employee_id);

    if (!attendance) {
      res.status(400).json({ error: "No active clock-in found for today" });
      return;
    }

    // Update clock_out_time and calculate duration
    await db.prepare(
      `UPDATE pos_agent_attendance
       SET clock_out_time = NOW(),
           work_duration_minutes = EXTRACT(EPOCH FROM (NOW() - clock_in_time)) / 60
       WHERE id = ?`
    ).run(attendance.id);

    const updatedAttendance = await db.prepare(
      `SELECT * FROM pos_agent_attendance WHERE id = ?`
    ).get(attendance.id);

    res.json({
      success: true,
      attendance: updatedAttendance,
      message: "Clocked out successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error clocking out:", error);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// DELETE /api/pos-agent/standalone-sales/:id - Delete a sale (public, token-based)
router.delete("/standalone-sales/:id", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { id } = req.params;
    const { token, employee_id } = req.body as { token?: string; employee_id?: string };

    if (!token || !employee_id) {
      res.status(400).json({ error: "Token and employee_id are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Delete sale lines first
    await db.prepare(`DELETE FROM pos_agent_sales_lines WHERE sale_id = ?`).run(id);

    // Delete sale
    const result = await db.prepare(
      `DELETE FROM pos_agent_sales WHERE id = ? AND employee_id = ?`
    ).run(id, employee_id);

    if (result.changes === 0) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }

    res.json({ success: true, message: "Sale deleted successfully" });
  } catch (error) {
    console.error("[POS Agent] Error deleting sale:", error);
    res.status(500).json({ error: "Failed to delete sale" });
  }
});

// POST /api/pos-agent/standalone-sales/bulk-delete - Bulk delete sales (public, token-based)
router.post("/standalone-sales/bulk-delete", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, sale_ids } = req.body as {
      token?: string;
      employee_id?: string;
      sale_ids?: string[];
    };

    if (!token || !employee_id || !sale_ids || sale_ids.length === 0) {
      res.status(400).json({ error: "Token, employee_id, and sale_ids are required" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    const placeholders = sale_ids.map(() => '?').join(',');
    // Delete sale lines first
    await db.prepare(
      `DELETE FROM pos_agent_sales_lines WHERE sale_id IN (${placeholders})`
    ).run(...sale_ids);

    // Delete sales
    const result = await db.prepare(
      `DELETE FROM pos_agent_sales WHERE id IN (${placeholders}) AND employee_id = ?`
    ).run(...sale_ids, employee_id);

    res.json({ success: true, message: `Deleted ${result.changes} sales successfully` });
  } catch (error) {
    console.error("[POS Agent] Error bulk deleting sales:", error);
    res.status(500).json({ error: "Failed to bulk delete sales" });
  }
});

// POST /api/pos-agent/standalone-returns - Create a return (public, token-based)
router.post("/standalone-returns", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, lines, total_amount } = req.body as {
      token?: string;
      employee_id?: string;
      lines?: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>;
      total_amount?: number;
    };

    if (!token || !employee_id || !lines || lines.length === 0) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Validate token
    const tokenData = await db.prepare(
      `SELECT id, user_id, is_active, expires_at
       FROM pos_agent_tokens
       WHERE token = ? AND is_active = 1`
    ).get(token);

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    const returnId = randomUUID();

    // Insert return record (using pos_agent_sales table with negative amounts)
    await db.prepare(
      `INSERT INTO pos_agent_sales (id, user_id, employee_id, customer_name, total_amount, paid_amount, credit_amount, payment_method, sale_date)
       VALUES (?, ?, ?, 'استرجاع', ?, 0, ?, 'return', NOW())`
    ).run(returnId, tokenData.user_id, employee_id, -Math.abs(total_amount || 0), -Math.abs(total_amount || 0));

    // Insert return lines and update inventory (add stock back)
    for (const line of lines) {
      const lineId = randomUUID();
      await db.prepare(
        `INSERT INTO pos_agent_sales_lines (id, sale_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(lineId, returnId, line.product_id, line.product_name, -line.quantity, line.unit_price, -line.line_total);

      // Update inventory stock (add back)
      const updateResult = await db.prepare(
        `UPDATE inventory_products
         SET stock_pieces = stock_pieces + ?
         WHERE id = ? AND user_id = ?`
      ).run(line.quantity, line.product_id, tokenData.user_id);
      
      console.log("[POS Agent] Return stock update result:", { productId: line.product_id, quantity: line.quantity, changes: updateResult.changes });
    }

    res.json({
      success: true,
      message: "Return processed successfully"
    });
  } catch (error) {
    console.error("[POS Agent] Error processing return:", error);
    res.status(500).json({ error: "Failed to process return" });
  }
});

// POST /api/pos-agent/standalone-products - Create a new product
router.post("/standalone-products", async (req, res) => {
  try {
    const { token } = req.query;
    const { name, sku, unit_price, stock_pieces, unit_kind, pieces_per_carton, image_url } = req.body;

    if (!token) {
      res.status(401).json({ error: "Token required" });
      return;
    }

    // Validate token and get user_id
    const tokenData = await db.prepare(
      `SELECT user_id FROM pos_agent_tokens WHERE token = ? AND is_active = 1 AND expires_at > NOW()`
    ).get(token as string);

    if (!tokenData) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const userId = (tokenData as { user_id: string }).user_id;

    // Check if product with same SKU already exists
    const existing = await db.prepare(
      `SELECT id FROM inventory_products WHERE sku = ? AND user_id = ?`
    ).get(sku, userId);

    if (existing) {
      res.status(400).json({ error: "Product with this SKU already exists" });
      return;
    }

    // Insert new product
    const id = randomUUID();
    await db.prepare(
      `INSERT INTO inventory_products (id, user_id, name, sku, unit_price, stock_pieces, unit_kind, pieces_per_carton, image_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`
    ).run(id, userId, name, sku, unit_price, stock_pieces || 0, unit_kind || "piece", pieces_per_carton || 1, image_url || null);

    res.json({ success: true, product: { id, name, sku, unit_price, stock_pieces, unit_kind, pieces_per_carton, image_url } });
  } catch (error) {
    console.error("[POS Agent] Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/pos-agent/standalone-products/:id - Update a product
router.put("/standalone-products/:id", async (req, res) => {
  try {
    const { token } = req.query;
    const { id } = req.params;
    const { name, sku, unit_price, stock_pieces, unit_kind, pieces_per_carton, image_url } = req.body;

    console.log("[POS Agent] Update product request:", { id, name, sku, unit_price, stock_pieces, hasImage: !!image_url, imageLength: image_url?.length });

    if (!token) {
      res.status(401).json({ error: "Token required" });
      return;
    }

    // Validate token and get user_id
    const tokenData = await db.prepare(
      `SELECT user_id FROM pos_agent_tokens WHERE token = ? AND is_active = 1 AND expires_at > NOW()`
    ).get(token as string);

    if (!tokenData) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const userId = (tokenData as { user_id: string }).user_id;
    console.log("[POS Agent] Update product - userId:", userId);

    // Check if product exists and belongs to user
    const existing = await db.prepare(
      `SELECT id FROM inventory_products WHERE id = ? AND user_id = ?`
    ).get(id, userId);

    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Check if another product with same SKU exists
    if (sku) {
      const skuConflict = await db.prepare(
        `SELECT id FROM inventory_products WHERE sku = ? AND user_id = ? AND id != ?`
      ).get(sku, userId, id);

      if (skuConflict) {
        res.status(400).json({ error: "Product with this SKU already exists" });
        return;
      }
    }

    // Update product
    const result = await db.prepare(
      `UPDATE inventory_products
       SET name = COALESCE(?, name),
           sku = COALESCE(?, sku),
           unit_price = COALESCE(?, unit_price),
           stock_pieces = COALESCE(?, stock_pieces),
           unit_kind = COALESCE(?, unit_kind),
           pieces_per_carton = COALESCE(?, pieces_per_carton),
           image_url = ?,
           updated_at = NOW()
       WHERE id = ? AND user_id = ?`
    ).run(name, sku, unit_price, stock_pieces, unit_kind, pieces_per_carton, image_url || null, id, userId);

    console.log("[POS Agent] Update product result:", { changes: result.changes });
    res.json({ success: true, message: "Product updated successfully" });
  } catch (error) {
    console.error("[POS Agent] Error updating product:", error);
    console.error("[POS Agent] Error details:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update product", details: error instanceof Error ? error.message : String(error) });
  }
});

// DELETE /api/pos-agent/standalone-products/:id - Delete a product
router.delete("/standalone-products/:id", async (req, res) => {
  try {
    const { token } = req.query;
    const { id } = req.params;

    if (!token) {
      res.status(401).json({ error: "Token required" });
      return;
    }

    // Validate token and get user_id
    const tokenData = await db.prepare(
      `SELECT user_id FROM pos_agent_tokens WHERE token = ? AND is_active = 1 AND expires_at > NOW()`
    ).get(token as string);

    if (!tokenData) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const userId = (tokenData as { user_id: string }).user_id;

    // Delete product
    const result = await db.prepare(
      `DELETE FROM inventory_products WHERE id = ? AND user_id = ?`
    ).run(id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("[POS Agent] Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export function registerPosAgentRoutes(app: express.Express, authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) {
  // Apply auth middleware to all routes except validate, standalone, session, attendance, and standalone-products routes
  app.use("/api/pos-agent", (req, res, next) => {
    const path = req.path;
    // Allow public access to validate, standalone, session, attendance, and standalone-products routes
    if (path.startsWith("/validate") || path.startsWith("/standalone") || path.startsWith("/session") || path.startsWith("/attendance")) {
      next();
    } else {
      authMiddleware(req, res, next);
    }
  }, router);
}
