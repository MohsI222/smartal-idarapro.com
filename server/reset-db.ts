/**
 * مسح كل الحسابات ثم إنشاء مشرف عام واحد (من admin-config / .env).
 * تشغيل: npm run db:reset
 */
import "dotenv/config";
import { initDatabase } from "./db.js";
import { ensureSuperAdmin, purgeAllUserData } from "./seed.js";

await initDatabase();
await purgeAllUserData();
await ensureSuperAdmin();
console.log("[idara] اكتملت إعادة ضبط قاعدة البيانات.");
