/**
 * تطبيق `server/schema.sql` على Postgres (Supabase) دون مسح بيانات.
 * تشغيل: npm run db:schema
 */
import "./loadEnv.js";
import { db, initDatabase } from "./db";

await initDatabase();
console.log("[idara] تم تطبيق المخطط على قاعدة البيانات.");
