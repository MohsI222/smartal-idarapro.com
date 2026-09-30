/**
 * Execute schema.sql on Neon database
 */
import "./loadEnv.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applySchema() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const pool = new Pool({ connectionString });

  try {
    console.log("[schema] Connecting to Neon database...");
    await pool.connect();
    
    console.log("[schema] Executing schema.sql...");
    await pool.query(schema);
    
    console.log("[schema] ✅ Schema applied successfully!");
  } catch (error) {
    console.error("[schema] ❌ Error applying schema:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

await applySchema();
