/**
 * مسح كل الحسابات ثم إنشاء مشرف عام واحد (من admin-config / .env).
 * تشغيل: npm run db:reset
 */
import "dotenv/config";
import { ensureSuperAdmin, purgeAllUserData } from "./seed.js";

purgeAllUserData();
ensureSuperAdmin();
console.log("[idara] اكتملت إعادة ضبط قاعدة البيانات.");
