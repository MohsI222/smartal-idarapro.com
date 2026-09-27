/**
 * Contracts & Electronic Signature Module Routes
 * وحدة العقود والتوقيع الإلكتروني
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "./db.js";
import type { Request, Response, NextFunction } from "express";

// Simple auth middleware for contracts module
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization;
    const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) {
      console.log("[Contracts Auth] No token provided");
      res.status(401).json({ error: "Unauthorized - No token" });
      return;
    }

    const { verifyToken } = await import("./crypto.js");
    const payload = verifyToken(token);
    if (!payload || !payload.sub) {
      console.log("[Contracts Auth] Invalid token payload");
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    console.log("[Contracts Auth] User authenticated:", payload.sub);
    (req as any).userId = payload.sub;
    next();
  } catch (error) {
    console.log("[Contracts Auth] Error:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
}

type Req = Request & { userId: string };

const router = Router();

// Types
export type ContractStatus = "draft" | "pending_signature" | "signed" | "rejected" | "expired";
export type ContractType = "rental" | "sales" | "employment" | "service" | "custom";

// Contract signature record
export type ContractSignature = {
  id: string;
  contract_id: string;
  signer_name: string;
  signer_email: string;
  signer_phone: string;
  signature_data: string; // Base64 encoded signature image
  signed_at: string;
  ip_address: string;
  user_agent: string;
};

// Contract record
export type Contract = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  contract_type: ContractType;
  status: ContractStatus;
  template_id: string | null;
  content: string; // HTML content of the contract
  pdf_url: string | null;
  parties: string; // JSON array of parties involved
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  logo_url: string | null;
};

// Contract template
export type ContractTemplate = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  contract_type: ContractType;
  content: string; // HTML template with placeholders
  is_public: boolean;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
};

// Initialize contracts tables
export async function initContractsTables() {
  try {
    // Contracts table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS public.contracts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        contract_type TEXT NOT NULL DEFAULT 'custom',
        status TEXT NOT NULL DEFAULT 'draft',
        template_id TEXT,
        content TEXT NOT NULL,
        pdf_url TEXT,
        parties TEXT,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        logo_url TEXT
      );
    `).run();

    // Contract signatures table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS public.contract_signatures (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
        signer_name TEXT NOT NULL,
        signer_email TEXT NOT NULL,
        signer_phone TEXT,
        signature_data TEXT NOT NULL,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      );
    `).run();

    // Contract templates table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS public.contract_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        contract_type TEXT NOT NULL DEFAULT 'custom',
        content TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_public BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        logo_url TEXT
      );
    `).run();

    // Create indexes
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_contracts_user ON public.contracts(user_id);`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures(contract_id);`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_contract_templates_user ON public.contract_templates(user_id);`).run();

    // Add is_public column to contract_templates if it doesn't exist
    try {
      await db.prepare(`
        ALTER TABLE public.contract_templates
        ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false
      `).run();
      console.log("[Contracts] Added is_public column to contract_templates");
    } catch (alterErr) {
      console.warn("[Contracts] Could not add is_public column:", alterErr instanceof Error ? alterErr.message : alterErr);
    }

    // Add logo_url column to contracts if it doesn't exist
    try {
      await db.prepare(`
        ALTER TABLE public.contracts
        ADD COLUMN IF NOT EXISTS logo_url TEXT
      `).run();
      console.log("[Contracts] Added logo_url column to contracts");
    } catch (alterErr) {
      console.warn("[Contracts] Could not add logo_url column to contracts:", alterErr instanceof Error ? alterErr.message : alterErr);
    }

    // Add logo_url column to contract_templates if it doesn't exist
    try {
      await db.prepare(`
        ALTER TABLE public.contract_templates
        ADD COLUMN IF NOT EXISTS logo_url TEXT
      `).run();
      console.log("[Contracts] Added logo_url column to contract_templates");
    } catch (alterErr) {
      console.warn("[Contracts] Could not add logo_url column to contract_templates:", alterErr instanceof Error ? alterErr.message : alterErr);
    }

    console.log("[Contracts] Tables initialized successfully");
  } catch (error) {
    console.error("[Contracts] Error initializing tables:", error);
    throw error;
  }
}

// API Routes

// Get all contracts for user
router.get("/api/contracts", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const contracts = await db.prepare(`
      SELECT * FROM public.contracts 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
    
    res.json({ contracts: contracts || [] });
  } catch (error) {
    console.error("[Contracts] Error fetching contracts:", error);
    res.status(500).json({ error: "فشل تحميل العقود" });
  }
});

// Get contract by ID
router.get("/api/contracts/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const contractId = req.params.id;

    console.log("[Contracts] Fetching contract:", contractId, "for user:", userId);

    const contract = await db.prepare(`
      SELECT id, user_id, title, description, contract_type, status, template_id,
             content, pdf_url, parties, start_date, end_date, created_at, updated_at, expires_at
      FROM public.contracts
      WHERE id = ? AND user_id = ?
    `).get(contractId, userId);

    if (!contract) {
      console.log("[Contracts] Contract not found");
      res.status(404).json({ error: "العقد غير موجود" });
      return;
    }

    // Get signatures for this contract
    const signatures = await db.prepare(`
      SELECT id, contract_id, signer_name, signer_email, signer_phone,
             signature_data, signed_at, ip_address, user_agent
      FROM public.contract_signatures
      WHERE contract_id = ?
      ORDER BY signed_at ASC
    `).all(contractId) as any[];

    console.log("[Contracts] Contract fetched successfully, signatures count:", signatures?.length);
    if (signatures && Array.isArray(signatures) && signatures.length > 0) {
      console.log("[Contracts] First signature data length:", signatures[0].signature_data?.length);
    }

    res.json({ contract, signatures: signatures || [] });
  } catch (error) {
    console.error("[Contracts] Error fetching contract:", error);
    res.status(500).json({ error: "فشل تحميل العقد" });
  }
});

// Create new contract
router.post("/api/contracts", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const { title, description, contract_type, content, parties, start_date, end_date, expires_at, template_id, logo_url } = req.body;
    
    if (!title || !content) {
      res.status(400).json({ error: "العنوان والمحتوى مطلوبان" });
      return;
    }
    
    const contractId = randomUUID();
    await db.prepare(`
      INSERT INTO public.contracts (
        id, user_id, title, description, contract_type, status, 
        content, parties, start_date, end_date, expires_at, template_id, logo_url
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contractId,
      userId,
      title,
      description || null,
      contract_type || 'custom',
      content,
      parties || null,
      start_date || null,
      end_date || null,
      expires_at || null,
      template_id || null,
      logo_url || null
    );
    
    res.json({ contract_id: contractId });
  } catch (error) {
    console.error("[Contracts] Error creating contract:", error);
    res.status(500).json({ error: "فشل إنشاء العقد" });
  }
});

// Update contract
router.put("/api/contracts/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const contractId = req.params.id;
    const { title, description, content, parties, start_date, end_date, expires_at, status, logo_url } = req.body;

    // Verify ownership and get current values
    const existing = await db.prepare(`
      SELECT id, title, description, content, parties, start_date, end_date, expires_at, status
      FROM public.contracts WHERE id = ? AND user_id = ?
    `).get(contractId, userId);

    if (!existing) {
      res.status(404).json({ error: "العقد غير موجود" });
      return;
    }

    // Build dynamic update query with only provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push("title = ?");
      values.push(title);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description || null);
    }
    if (content !== undefined) {
      updates.push("content = ?");
      values.push(content);
    }
    if (parties !== undefined) {
      updates.push("parties = ?");
      values.push(parties || null);
    }
    if (start_date !== undefined) {
      updates.push("start_date = ?");
      values.push(start_date || null);
    }
    if (end_date !== undefined) {
      updates.push("end_date = ?");
      values.push(end_date || null);
    }
    if (expires_at !== undefined) {
      updates.push("expires_at = ?");
      values.push(expires_at || null);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);
    }
    if (logo_url !== undefined) {
      updates.push("logo_url = ?");
      values.push(logo_url || null);
    }

    updates.push("updated_at = NOW()");
    values.push(contractId);

    if (updates.length === 1) {
      // Only updated_at was added, no actual changes
      res.json({ success: true });
      return;
    }

    await db.prepare(`
      UPDATE public.contracts
      SET ${updates.join(", ")}
      WHERE id = ?
    `).run(...values);

    res.json({ success: true });
  } catch (error) {
    console.error("[Contracts] Error updating contract:", error);
    res.status(500).json({ error: "فشل تحديث العقد" });
  }
});

// Delete contract
router.delete("/api/contracts/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const contractId = req.params.id;
    
    // Verify ownership
    const existing = await db.prepare(`
      SELECT id FROM public.contracts WHERE id = ? AND user_id = ?
    `).get(contractId, userId);
    
    if (!existing) {
      res.status(404).json({ error: "العقد غير موجود" });
      return;
    }
    
    await db.prepare(`DELETE FROM public.contracts WHERE id = ?`).run(contractId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Contracts] Error deleting contract:", error);
    res.status(500).json({ error: "فشل حذف العقد" });
  }
});

// Public endpoint to view contract for signing (no auth required)
router.get("/api/contracts/public/:id", async (req, res) => {
  try {
    const contractId = req.params.id;

    console.log("[Contracts] Public contract request:", contractId);

    const contract = await db.prepare(`
      SELECT id, title, description, content, parties, start_date, end_date, expires_at, status, logo_url
      FROM public.contracts
      WHERE id = ?
    `).get(contractId);

    if (!contract) {
      console.log("[Contracts] Contract not found:", contractId);
      res.status(404).json({ error: "العقد غير موجود" });
      return;
    }

    console.log("[Contracts] Contract found, status:", contract.status, "expires_at:", contract.expires_at);

    // Check if expired (only if expires_at is set)
    if (contract.expires_at) {
      const expiryDate = new Date(contract.expires_at as string);
      if (!isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
        console.log("[Contracts] Contract expired on:", expiryDate);
        // Don't block expired contracts, just log it
        // res.status(400).json({ error: "العقد منتهي الصلاحية" });
        // return;
      }
    }

    res.json({ contract });
  } catch (error) {
    console.error("[Contracts] Error fetching public contract:", error);
    res.status(500).json({ error: "فشل تحميل العقد" });
  }
});

// Submit signature (public endpoint)
router.post("/api/contracts/:id/sign", async (req, res) => {
  try {
    const contractId = req.params.id;
    const { signer_name, signer_email, signer_phone, signature_data } = req.body;
    
    if (!signer_name || !signer_email || !signature_data) {
      res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
      return;
    }
    
    // Verify contract exists and is pending
    const contract = await db.prepare(`
      SELECT id, status FROM public.contracts WHERE id = ?
    `).get(contractId);
    
    if (!contract) {
      res.status(404).json({ error: "العقد غير موجود" });
      return;
    }
    
    if (contract.status !== 'pending_signature') {
      res.status(400).json({ error: "العقد ليس في حالة انتظار التوقيع" });
      return;
    }
    
    const signatureId = randomUUID();
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log("[Contracts] Saving signature, signature_data length:", signature_data?.length);

    await db.prepare(`
      INSERT INTO public.contract_signatures (
        id, contract_id, signer_name, signer_email, signer_phone,
        signature_data, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      signatureId,
      contractId,
      signer_name,
      signer_email,
      signer_phone || null,
      signature_data,
      ip,
      userAgent
    );

    console.log("[Contracts] Signature saved successfully, ID:", signatureId);
    
    // Update contract status to signed
    await db.prepare(`
      UPDATE public.contracts SET status = 'signed', updated_at = NOW() WHERE id = ?
    `).run(contractId);
    
    res.json({ signature_id: signatureId });
  } catch (error) {
    console.error("[Contracts] Error submitting signature:", error);
    res.status(500).json({ error: "فشل حفظ التوقيع" });
  }
});

// Contract Templates Routes

// Get all templates for user
router.get("/api/contract-templates", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const templates = await db.prepare(`
      SELECT * FROM public.contract_templates 
      WHERE user_id = ? OR is_public = true
      ORDER BY created_at DESC
    `).all(userId);
    
    res.json({ templates: templates || [] });
  } catch (error) {
    console.error("[Contracts] Error fetching templates:", error);
    res.status(500).json({ error: "فشل تحميل القوالب" });
  }
});

// Create template
router.post("/api/contract-templates", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const { name, description, contract_type, content, is_public, logo_url } = req.body;

    if (!name || !content) {
      res.status(400).json({ error: "الاسم والمحتوى مطلوبان" });
      return;
    }

    const templateId = randomUUID();
    await db.prepare(`
      INSERT INTO public.contract_templates (
        id, user_id, name, description, contract_type, content, is_public, logo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      templateId,
      userId,
      name,
      description || null,
      contract_type || 'custom',
      content,
      is_public || false,
      logo_url || null
    );

    res.json({ template_id: templateId });
  } catch (error) {
    console.error("[Contracts] Error creating template:", error);
    res.status(500).json({ error: "فشل إنشاء القالب" });
  }
});

// Update template
router.put("/api/contract-templates/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const templateId = req.params.id;
    const { name, description, content, is_public, logo_url } = req.body;
    
    // Verify ownership
    const existing = await db.prepare(`
      SELECT id FROM public.contract_templates WHERE id = ? AND user_id = ?
    `).get(templateId, userId);
    
    if (!existing) {
      res.status(404).json({ error: "القالب غير موجود" });
      return;
    }
    
    await db.prepare(`
      UPDATE public.contract_templates 
      SET name = ?, description = ?, content = ?, is_public = ?, logo_url = ?, updated_at = NOW()
      WHERE id = ?
    `).run(
      name,
      description || null,
      content,
      is_public || false,
      logo_url || null,
      templateId
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Contracts] Error updating template:", error);
    res.status(500).json({ error: "فشل تحديث القالب" });
  }
});

// Delete template
router.delete("/api/contract-templates/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as Req).userId;
    const templateId = req.params.id;
    
    // Verify ownership
    const existing = await db.prepare(`
      SELECT id FROM public.contract_templates WHERE id = ? AND user_id = ?
    `).get(templateId, userId);
    
    if (!existing) {
      res.status(404).json({ error: "القالب غير موجود" });
      return;
    }
    
    await db.prepare(`DELETE FROM public.contract_templates WHERE id = ?`).run(templateId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Contracts] Error deleting template:", error);
    res.status(500).json({ error: "فشل حذف القالب" });
  }
});

export default router;
