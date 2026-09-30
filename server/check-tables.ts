/**
 * Check if delivery_hub tables exist in Supabase
 */
import "./loadEnv.js";
import { db } from "./db.js";

async function checkTables() {
  try {
    console.log("[check] Checking delivery_hub tables...");

    // Check delivery_hub_stores
    try {
      const stores = await db.prepare(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'delivery_hub_stores' AND table_schema = 'public'
      `).all();
      console.log("[check] delivery_hub_stores columns:", stores);
    } catch (err) {
      console.log("[check] delivery_hub_stores does not exist:", err instanceof Error ? err.message : err);
    }

    // Check delivery_hub_products
    try {
      const products = await db.prepare(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'delivery_hub_products' AND table_schema = 'public'
      `).all();
      console.log("[check] delivery_hub_products columns:", products);
    } catch (err) {
      console.log("[check] delivery_hub_products does not exist:", err instanceof Error ? err.message : err);
    }

    // Check delivery_hub_orders
    try {
      const orders = await db.prepare(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'delivery_hub_orders' AND table_schema = 'public'
      `).all();
      console.log("[check] delivery_hub_orders columns:", orders);
    } catch (err) {
      console.log("[check] delivery_hub_orders does not exist:", err instanceof Error ? err.message : err);
    }

    // Check hr_employees
    try {
      const employees = await db.prepare(`
        SELECT COUNT(*) as count FROM hr_employees
      `).get() as { count: number };
      console.log("[check] hr_employees count:", employees.count);
    } catch (err) {
      console.log("[check] hr_employees error:", err instanceof Error ? err.message : err);
    }

  } catch (error) {
    console.error("[check] ❌ Error:", error);
  }
}

await checkTables();
