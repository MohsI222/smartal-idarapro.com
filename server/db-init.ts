/**
 * تطبيق `server/schema.sql` على Postgres (Supabase) دون مسح بيانات.
 * تشغيل: npm run db:schema
 */
import "dotenv/config";
import { initDatabase } from "./db.js";

await initDatabase();
console.log("[idara] تم تطبيق المخطط على قاعدة البيانات.");
