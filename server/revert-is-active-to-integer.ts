/**
 * Revert delivery_hub_products.is_active back to INTEGER
 */
import "./loadEnv.js";
import { db } from "./db.js";

async function revertToInteger() {
  try {
    console.log("[revert] Converting delivery_hub_products.is_active back to INTEGER...");

    await db.prepare(`
      ALTER TABLE public.delivery_hub_products 
      ALTER COLUMN is_active TYPE INTEGER USING is_active::integer
    `).run();
    
    console.log("[revert] ✅ delivery_hub_products.is_active reverted to INTEGER!");
  } catch (error) {
    console.error("[revert] ❌ Error:", error);
    throw error;
  }
}

await revertToInteger();
