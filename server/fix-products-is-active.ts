/**
 * Drop and recreate is_active column as INTEGER in delivery_hub_products
 */
import "./loadEnv.js";
import { db } from "./db.js";

async function fixProductsIsActive() {
  try {
    console.log("[fix] Dropping is_active column from delivery_hub_products...");

    await db.prepare(`
      ALTER TABLE public.delivery_hub_products DROP COLUMN IF EXISTS is_active
    `).run();
    
    console.log("[fix] ✅ Column dropped");

    console.log("[fix] Recreating is_active as INTEGER...");
    await db.prepare(`
      ALTER TABLE public.delivery_hub_products 
      ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1
    `).run();
    
    console.log("[fix] ✅ is_active recreated as INTEGER!");
  } catch (error) {
    console.error("[fix] ❌ Error:", error);
    throw error;
  }
}

await fixProductsIsActive();
