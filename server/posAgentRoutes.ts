import express from "express";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";

// Helper function to update Supabase for real-time sync
async function updateSupabaseStock(productId: string, _stockChange: number, userId: string) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
    
    if (!supabaseUrl || !supabaseKey) {
      console.log("[POS Agent] Supabase not configured, skipping sync");
      return;
    }

    // Get current stock from Neon (the source of truth)
    const product = await db.prepare(
      `SELECT stock_pieces FROM inventory_products WHERE id = ? AND user_id = ?`
    ).get(productId, userId) as { stock_pieces: number } | undefined;

    if (!product) {
      console.log("[POS Agent] Product not found in Neon, skipping sync");
      return;
    }

    const newStock = product.stock_pieces;

    // Update Supabase with the exact stock from Neon
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/inventory_products?id=eq.${productId}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stock_pieces: newStock }),
    });

    if (!updateResponse.ok) {
      console.error("[POS Agent] Failed to update Supabase:", updateResponse.status);
    } else {
      console.log("[POS Agent] Successfully synced stock to Supabase:", { productId, newStock });
    }
  } catch (error) {
    console.error("[POS Agent] Error syncing to Supabase:", error);
  }
}

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

    // SECURITY: Log who is generating the token
    console.log("[POS Agent] SECURITY: Token being generated for user_id:", userId);

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

    // SECURITY: Get employee details and verify ownership
    // Employee must belong to the same user_id as the token
    const employee = await db.prepare(
      `SELECT id, employee_id, full_name as name, role_title as role, department, user_id
       FROM tl_workers
       WHERE employee_id = ? AND user_id = ?`
    ).get(employee_id, (tokenData as any).user_id);

    console.log("[POS Agent] SECURITY: Employee lookup for employee_id:", employee_id, "user_id:", (tokenData as any).user_id);
    console.log("[POS Agent] SECURITY: Employee found:", employee);

    if (!employee) {
      console.error("[POS Agent] SECURITY: Employee not found or doesn't belong to token owner");
      res.status(404).json({ error: "Employee not found or unauthorized" });
      return;
    }

    // Double-check: employee.user_id must match token.user_id
    if (employee.user_id !== (tokenData as any).user_id) {
      console.error("[POS Agent] SECURITY VIOLATION: Employee user_id mismatch!", {
        token_user_id: (tokenData as any).user_id,
        employee_user_id: employee.user_id
      });
      res.status(403).json({ error: "Unauthorized: Employee does not belong to your account" });
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
    const { token, employee_id, customer_name, lines, total_amount, paid_amount, credit_amount, payment_method, check_number, check_holder_name, check_holder_cin, tpe_transaction_id } = req.body as {
      token?: string;
      employee_id?: string;
      customer_name?: string;
      lines?: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>;
      total_amount?: number;
      paid_amount?: number;
      credit_amount?: number;
      payment_method?: string;
      check_number?: string;
      check_holder_name?: string;
      check_holder_cin?: string;
      tpe_transaction_id?: string;
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
      `INSERT INTO pos_agent_sales (id, user_id, employee_id, customer_name, total_amount, paid_amount, credit_amount, payment_method, check_number, check_holder_name, check_holder_cin, tpe_transaction_id, sale_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
    ).run(saleId, (tokenData as any).user_id, employee_id, customer_name || "عميل نقدي", total_amount, paid_amount, credit_amount, payment_method || "cash", check_number || null, check_holder_name || null, check_holder_cin || null, tpe_transaction_id || null);

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
      ).run(line.quantity, line.product_id, (tokenData as any).user_id);
      
      // Sync to Supabase for real-time updates
      await updateSupabaseStock(line.product_id, -line.quantity, (tokenData as any).user_id);
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
    ).run(attendanceId, (tokenData as any).user_id, employee_id);

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

    console.log("[POS Agent] SECURITY DEBUG: Token validation result:", {
      token: token?.substring(0, 20),
      tokenData: tokenData ? {
        id: (tokenData as any).id,
        user_id: (tokenData as any).user_id,
        is_active: (tokenData as any).is_active,
        expires_at: (tokenData as any).expires_at
      } : null
    });

    if (!tokenData) {
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      res.status(401).json({ error: "Token expired" });
      return;
    }

    const userIdToUse = (tokenData as any).user_id;
    console.log("[POS Agent] SECURITY DEBUG: Using user_id for employee query:", userIdToUse);

    // SECURITY: Load only TL workers belonging to the token's user_id
    // This prevents users from accessing other accounts' employees
    const employees = await db.prepare(
      `SELECT id, employee_id as employee_id, full_name as name, role_title as role, department, user_id
       FROM tl_workers
       WHERE user_id = ?
       ORDER BY full_name ASC`
    ).all(userIdToUse);

    console.log("[POS Agent] SECURITY: Loaded employees for user_id:", userIdToUse, "Count:", employees.length);
    if (employees.length > 0) {
      console.log("[POS Agent] SECURITY: First employee user_id:", (employees[0] as any).user_id);
    }

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
    const { token, employee_id, customer_name, lines, total_amount, paid_amount, credit_amount, payment_method, check_number, check_holder_name, check_holder_cin, tpe_transaction_id } = req.body as {
      token?: string;
      employee_id?: string;
      customer_name?: string;
      lines?: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>;
      total_amount?: number;
      paid_amount?: number;
      credit_amount?: number;
      payment_method?: string;
      check_number?: string;
      check_holder_name?: string;
      check_holder_cin?: string;
      tpe_transaction_id?: string;
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
      `INSERT INTO pos_agent_sales (id, user_id, employee_id, customer_name, total_amount, paid_amount, credit_amount, payment_method, check_number, check_holder_name, check_holder_cin, tpe_transaction_id, sale_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
    ).run(saleId, (tokenData as any).user_id, employee_id, customer_name || "عميل نقدي", total_amount, paid_amount, credit_amount, payment_method || "cash", check_number || null, check_holder_name || null, check_holder_cin || null, tpe_transaction_id || null);

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
      ).run(line.quantity, line.product_id, (tokenData as any).user_id);
      
      console.log("[POS Agent] Stock update result:", { productId: line.product_id, quantity: line.quantity, changes: updateResult.changes });
      
      // Sync to Supabase for real-time updates
      await updateSupabaseStock(line.product_id, -line.quantity, (tokenData as any).user_id);
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
    ).run(attendanceId, (tokenData as any).user_id, employee_id);

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

// DELETE /api/pos-agent/standalone-sales/bulk-delete - Bulk delete sales (public, token-based)
router.delete("/standalone-sales/bulk-delete", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, sale_ids } = req.body as {
      token?: string;
      employee_id?: string;
      sale_ids?: string[];
    };

    console.log("[POS Agent] Bulk delete sales request:", { token, employee_id, sale_ids });

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

    console.log("[POS Agent] Bulk delete sales result:", { changes: result.changes });

    res.json({ success: true, message: `Deleted ${result.changes} sales successfully` });
  } catch (error) {
    console.error("[POS Agent] Error bulk deleting sales:", error);
    res.status(500).json({ error: "Failed to bulk delete sales" });
  }
});

// POST /api/pos-agent/rfid-detect - Detect products by RFID/SKU codes (bulk detection)
router.post("/rfid-detect", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, codes } = req.body as {
      token?: string;
      codes?: string[]; // Array of RFID codes or SKUs
    };

    if (!token || !codes || codes.length === 0) {
      res.status(400).json({ error: "Token and codes are required" });
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

    const userId = (tokenData as any).user_id;

    // Match codes with products (by SKU or RFID if exists)
    const placeholders = codes.map(() => '?').join(',');
    const products = await db.prepare(
      `SELECT id, name, sku, unit_price, stock_pieces, unit_kind, pieces_per_carton, image_url
       FROM inventory_products
       WHERE user_id = ? AND (sku IN (${placeholders}) OR id IN (${placeholders}))
       AND stock_pieces > 0`
    ).all(userId, ...codes, ...codes);

    console.log("[POS Agent] RFID detection - matched products:", products.length, "of", codes.length);

    res.json({
      success: true,
      products: products || [],
      detected_count: products.length,
      total_codes: codes.length
    });
  } catch (error) {
    console.error("[POS Agent] Error detecting RFID products:", error);
    res.status(500).json({ error: "Failed to detect products" });
  }
});

// OPTIONS /api/pos-agent/upload-file - Handle CORS preflight
router.options("/upload-file", async (_req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
});

// POST /api/pos-agent/upload-file - Upload file to Supabase Storage (public, token-based)
router.post("/upload-file", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    console.log("[POS Agent] Upload file request received");
    console.log("[POS Agent] Headers:", JSON.stringify(req.headers, null, 2));
    console.log("[POS Agent] Body keys:", Object.keys(req.body));

    // Get token from Authorization header OR body
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.body.token;

    const { file_data, file_name, file_type, file_path } = req.body as {
      token?: string;
      file_data?: string; // base64
      file_name?: string;
      file_type?: string;
      file_path?: string;
    };

    console.log("[POS Agent] Upload file request START:", { 
      hasToken: !!token, 
      tokenPrefix: token?.substring(0, 15), 
      hasFileData: !!file_data, 
      file_name, 
      file_path 
    });

    if (!token || !file_data || !file_name || !file_path) {
      console.error("[POS Agent] Missing required fields:", { hasToken: !!token, hasFileData: !!file_data, hasFileName: !!file_name, hasFilePath: !!file_path });
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
      console.error("[POS Agent] Invalid token - token not found in database");
      res.status(404).json({ error: "Invalid or inactive token" });
      return;
    }

    console.log("[POS Agent] Token validated:", { user_id: tokenData.user_id, is_active: tokenData.is_active });

    // Check if token is expired
    if (tokenData.expires_at && typeof tokenData.expires_at === 'string' && new Date(tokenData.expires_at) < new Date()) {
      console.error("[POS Agent] Token expired:", tokenData.expires_at);
      res.status(401).json({ error: "Token expired" });
      return;
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(file_data, 'base64');
    console.log("[POS Agent] Buffer created, size:", buffer.length);

    // Upload to Cloudinary
    const { uploadToCloudinary } = await import('./cloudinaryService.js');
    console.log("[POS Agent] Uploading to Cloudinary:", file_path);
    const publicUrl = await uploadToCloudinary(buffer, 'pos-agent', file_name, file_type || 'application/octet-stream');
    console.log("[POS Agent] Upload SUCCESS, URL:", publicUrl);

    res.json({
      success: true,
      public_url: publicUrl
    });
  } catch (error) {
    console.error("[POS Agent] Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// Handle OPTIONS preflight
router.options("/upload-file", (_req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
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
      `INSERT INTO pos_agent_sales (id, user_id, employee_id, customer_name, total_amount, paid_amount, credit_amount, payment_method, check_number, check_holder_name, check_holder_cin, sale_date)
       VALUES (?, ?, ?, 'استرجاع', ?, 0, ?, 'return', NULL, NULL, NULL, NOW())`
    ).run(returnId, (tokenData as any).user_id, employee_id, -Math.abs(total_amount || 0), -Math.abs(total_amount || 0));

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
      ).run(line.quantity, line.product_id, (tokenData as any).user_id);
      
      console.log("[POS Agent] Return stock update result:", { productId: line.product_id, quantity: line.quantity, changes: updateResult.changes });
      
      // Sync to Supabase for real-time updates
      await updateSupabaseStock(line.product_id, line.quantity, (tokenData as any).user_id);
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

// POST /api/pos-agent/gps-location - Log GPS location for worker
router.post("/gps-location", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, latitude, longitude, accuracy, source } = req.body as {
      token?: string;
      employee_id?: string;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      source?: string;
    };

    if (!token || !employee_id || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "Token, employee_id, latitude, and longitude are required" });
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

    // Log location
    const logId = randomUUID();
    await db.prepare(
      `INSERT INTO worker_location_logs (id, user_id, worker_id, latitude, longitude, accuracy, timestamp, source)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`
    ).run(logId, (tokenData as any).user_id, employee_id, latitude, longitude, accuracy || null, source || 'manual');

    // Update worker's current location
    await db.prepare(
      `UPDATE tl_workers
       SET latitude = ?, longitude = ?, location_updated_at = NOW()
       WHERE employee_id = ? AND user_id = ?`
    ).run(latitude, longitude, employee_id, (tokenData as any).user_id);

    res.json({ success: true, message: "Location logged successfully" });
  } catch (error) {
    console.error("[POS Agent] Error logging GPS location:", error);
    res.status(500).json({ error: "Failed to log location" });
  }
});

// POST /api/pos-agent/verify-visit - Verify worker visit to customer location
router.post("/verify-visit", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, customer_id, customer_name, customer_latitude, customer_longitude, worker_latitude, worker_longitude, visit_type, notes } = req.body as {
      token?: string;
      employee_id?: string;
      customer_id?: string;
      customer_name?: string;
      customer_latitude?: number;
      customer_longitude?: number;
      worker_latitude?: number;
      worker_longitude?: number;
      visit_type?: string;
      notes?: string;
    };

    if (!token || !employee_id || worker_latitude === undefined || worker_longitude === undefined) {
      res.status(400).json({ error: "Token, employee_id, and worker location are required" });
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

    // Calculate distance if customer location is provided
    let distanceMeters = null;
    let isVerified = false;

    if (customer_latitude !== undefined && customer_longitude !== undefined) {
      // Haversine formula to calculate distance
      const R = 6371000; // Earth's radius in meters
      const lat1Rad = (worker_latitude * Math.PI) / 180;
      const lat2Rad = (customer_latitude * Math.PI) / 180;
      const deltaLat = ((customer_latitude - worker_latitude) * Math.PI) / 180;
      const deltaLon = ((customer_longitude - worker_longitude) * Math.PI) / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      distanceMeters = R * c;

      // Consider verified if within 100 meters
      isVerified = distanceMeters <= 100;
    }

    // Log visit verification
    const visitId = randomUUID();
    await db.prepare(
      `INSERT INTO visit_verifications (id, user_id, worker_id, customer_id, customer_name, customer_latitude, customer_longitude, worker_latitude, worker_longitude, distance_meters, is_verified, visit_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(visitId, (tokenData as any).user_id, employee_id, customer_id || null, customer_name || null, customer_latitude || null, customer_longitude || null, worker_latitude, worker_longitude, distanceMeters, isVerified, visit_type || 'visit', notes || null);

    res.json({
      success: true,
      is_verified: isVerified,
      distance_meters: distanceMeters,
      message: isVerified ? "Visit verified within acceptable range" : "Visit outside acceptable range"
    });
  } catch (error) {
    console.error("[POS Agent] Error verifying visit:", error);
    res.status(500).json({ error: "Failed to verify visit" });
  }
});

// GET /api/pos-agent/loyalty-points - Get customer loyalty points by phone
router.get("/loyalty-points", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, phone } = req.query as { token?: string; phone?: string };

    if (!token || !phone) {
      res.status(400).json({ error: "Token and phone are required" });
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

    const userId = (tokenData as any).user_id;

    const loyalty = await db.prepare(
      `SELECT * FROM customer_loyalty
       WHERE user_id = ? AND phone_number = ?`
    ).get(userId, phone);

    res.json({
      success: true,
      points: loyalty?.points || 0,
      total_purchases: loyalty?.total_purchases || 0,
      customer_name: loyalty?.customer_name || null
    });
  } catch (error) {
    console.error("[POS Agent] Error fetching loyalty points:", error);
    res.status(500).json({ error: "Failed to fetch loyalty points" });
  }
});

// POST /api/pos-agent/loyalty-add - Add loyalty points for customer
router.post("/loyalty-add", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, phone, customer_name, purchase_amount, points_to_add } = req.body as {
      token?: string;
      phone?: string;
      customer_name?: string;
      purchase_amount?: number;
      points_to_add?: number;
    };

    if (!token || !phone || purchase_amount === undefined) {
      res.status(400).json({ error: "Token, phone, and purchase_amount are required" });
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

    const userId = (tokenData as any).user_id;

    // Check if customer exists
    const existing = await db.prepare(
      `SELECT * FROM customer_loyalty
       WHERE user_id = ? AND phone_number = ?`
    ).get(userId, phone);

    if (existing) {
      // Update existing customer
      await db.prepare(
        `UPDATE customer_loyalty
         SET points = points + ?, total_purchases = total_purchases + ?, customer_name = ?, updated_at = NOW()
         WHERE id = ?`
      ).run(points_to_add || Math.floor(purchase_amount), purchase_amount, customer_name || existing.customer_name, existing.id);
    } else {
      // Create new customer
      const loyaltyId = randomUUID();
      await db.prepare(
        `INSERT INTO customer_loyalty (id, user_id, phone_number, customer_name, points, total_purchases)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(loyaltyId, userId, phone, customer_name || null, points_to_add || Math.floor(purchase_amount), purchase_amount);
    }

    res.json({ success: true, message: "Loyalty points added successfully" });
  } catch (error) {
    console.error("[POS Agent] Error adding loyalty points:", error);
    res.status(500).json({ error: "Failed to add loyalty points" });
  }
});

// POST /api/pos-agent/expense - Add cash expense
router.post("/expense", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, amount, category, description } = req.body as {
      token?: string;
      employee_id?: string;
      amount?: number;
      category?: string;
      description?: string;
    };

    if (!token || !amount || !category) {
      res.status(400).json({ error: "Token, amount, and category are required" });
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

    const userId = (tokenData as any).user_id;
    const expenseId = randomUUID();

    await db.prepare(
      `INSERT INTO cash_expenses (id, user_id, employee_id, amount, category, description, expense_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`
    ).run(expenseId, userId, employee_id || null, amount, category, description || null);

    res.json({ success: true, message: "Expense added successfully" });
  } catch (error) {
    console.error("[POS Agent] Error adding expense:", error);
    res.status(500).json({ error: "Failed to add expense" });
  }
});

// GET /api/pos-agent/expenses - Get expenses for current day
router.get("/expenses", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id } = req.query as { token?: string; employee_id?: string };

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

    const userId = (tokenData as any).user_id;

    const expenses = await db.prepare(
      `SELECT * FROM cash_expenses
       WHERE user_id = ? AND DATE(expense_date) = CURRENT_DATE
       ${employee_id ? 'AND employee_id = ?' : ''}
       ORDER BY expense_date DESC`
    ).all(userId, employee_id || null);

    res.json({ success: true, expenses: expenses || [] });
  } catch (error) {
    console.error("[POS Agent] Error fetching expenses:", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

// DELETE /api/pos-agent/expense/:id - Delete single expense
router.delete("/expense/:id", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { id } = req.params;
    const { token, employee_id } = req.body as { token?: string; employee_id?: string };

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

    const userId = (tokenData as any).user_id;

    // Delete expense (ensure it belongs to the user)
    const result = await db.prepare(
      `DELETE FROM cash_expenses
       WHERE id = ? AND user_id = ? ${employee_id ? 'AND employee_id = ?' : ''}`
    ).run(id, userId, employee_id || null);

    if (result.changes === 0) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    res.json({ success: true, message: "Expense deleted successfully" });
  } catch (error) {
    console.error("[POS Agent] Error deleting expense:", error);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// DELETE /api/pos-agent/expenses/bulk-delete - Delete multiple expenses
router.delete("/expenses/bulk-delete", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, expense_ids } = req.body as {
      token?: string;
      employee_id?: string;
      expense_ids?: string[];
    };

    console.log("[POS Agent] Bulk delete request:", { token, employee_id, expense_ids });

    if (!token) {
      res.status(400).json({ error: "Token is required" });
      return;
    }

    if (!expense_ids || expense_ids.length === 0) {
      res.status(400).json({ error: "Expense IDs are required" });
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

    const userId = (tokenData as any).user_id;

    // Delete expenses (ensure they belong to the user)
    const placeholders = expense_ids.map(() => '?').join(',');
    const params = [...expense_ids, userId];
    if (employee_id) params.push(employee_id);

    const result = await db.prepare(
      `DELETE FROM cash_expenses
       WHERE id IN (${placeholders}) AND user_id = ? ${employee_id ? 'AND employee_id = ?' : ''}`
    ).run(...params);

    console.log("[POS Agent] Bulk delete result:", { changes: result.changes });

    res.json({
      success: true,
      message: `${result.changes} expenses deleted successfully`,
      deleted_count: result.changes
    });
  } catch (error) {
    console.error("[POS Agent] Error bulk deleting expenses:", error);
    res.status(500).json({ error: "Failed to delete expenses" });
  }
});

// POST /api/pos-agent/cash-drawer-summary - Create daily cash drawer summary
router.post("/cash-drawer-summary", async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    const { token, employee_id, opening_balance, actual_cash, notes } = req.body as {
      token?: string;
      employee_id?: string;
      opening_balance?: number;
      actual_cash?: number;
      notes?: string;
    };

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

    const userId = (tokenData as any).user_id;

    // Calculate today's sales
    const salesResult = await db.prepare(
      `SELECT COALESCE(SUM(paid_amount), 0) as total_sales
       FROM pos_agent_sales
       WHERE user_id = ? AND DATE(sale_date) = CURRENT_DATE
       ${employee_id ? 'AND employee_id = ?' : ''}`
    ).get(userId, employee_id || null);

    const totalSales = (salesResult as any)?.total_sales || 0;

    // Calculate today's expenses
    const expensesResult = await db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses
       FROM cash_expenses
       WHERE user_id = ? AND DATE(expense_date) = CURRENT_DATE
       ${employee_id ? 'AND employee_id = ?' : ''}`
    ).get(userId, employee_id || null);

    const totalExpenses = (expensesResult as any)?.total_expenses || 0;

    const expectedCash = (opening_balance || 0) + totalSales - totalExpenses;
    const difference = actual_cash !== undefined ? actual_cash - expectedCash : null;

    const summaryId = randomUUID();
    await db.prepare(
      `INSERT INTO cash_drawer_summaries (id, user_id, employee_id, summary_date, opening_balance, total_sales, total_expenses, expected_cash, actual_cash, difference, notes)
       VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?)`
    ).run(summaryId, userId, employee_id || null, opening_balance || 0, totalSales, totalExpenses, expectedCash, actual_cash || null, difference, notes || null);

    res.json({
      success: true,
      summary: {
        opening_balance: opening_balance || 0,
        total_sales: totalSales,
        total_expenses: totalExpenses,
        expected_cash,
        actual_cash: actual_cash || null,
        difference
      }
    });
  } catch (error) {
    console.error("[POS Agent] Error creating cash drawer summary:", error);
    res.status(500).json({ error: "Failed to create cash drawer summary" });
  }
});

export function registerPosAgentRoutes(app: express.Express, authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) {
  // Handle OPTIONS preflight requests for DELETE methods
  app.options("/api/pos-agent/expense/:id", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  app.options("/api/pos-agent/expenses/bulk-delete", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  app.options("/api/pos-agent/standalone-sales/:id", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  app.options("/api/pos-agent/standalone-sales/bulk-delete", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
  });

  // Apply auth middleware to all routes except validate, standalone, session, attendance, upload-file, standalone-products, loyalty, expenses, and cash-drawer routes
  app.use("/api/pos-agent", (req, res, next) => {
    const path = req.path;
    // Allow public access to validate, standalone, session, attendance, upload-file, standalone-products, loyalty, expenses, and cash-drawer routes
    // These routes use their own token validation via pos_agent_tokens table
    if (path.startsWith("/validate") || path.startsWith("/standalone") || path.startsWith("/session") || path.startsWith("/attendance") || path.startsWith("/upload-file") || path.startsWith("/loyalty") || path.startsWith("/expense") || path.startsWith("/expenses") || path.startsWith("/cash-drawer") || path.startsWith("/rfid") || path.startsWith("/gps")) {
      next();
    } else {
      authMiddleware(req, res, next);
    }
  }, router);
}
