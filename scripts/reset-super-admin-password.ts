/**
 * Reset Super Admin password manually
 * Run with: npx tsx scripts/reset-super-admin-password.ts
 */
import "dotenv/config";
import { db } from "../server/db.js";
import { hashPassword } from "../server/crypto.js";
import { SUPER_ADMIN_EMAIL, getSuperAdminPassword } from "../server/admin-config.js";

async function resetPassword() {
  try {
    const user = await db
      .prepare("SELECT id, email FROM users WHERE email = ?")
      .get(SUPER_ADMIN_EMAIL) as { id: string; email: string } | undefined;

    if (!user) {
      console.error("Super Admin user not found:", SUPER_ADMIN_EMAIL);
      process.exit(1);
    }

    const newPassword = getSuperAdminPassword();
    const newHash = hashPassword(newPassword);

    await db
      .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .run(newHash, user.id);

    console.log("✅ Password reset successfully for:", SUPER_ADMIN_EMAIL);
    console.log("📧 Email:", SUPER_ADMIN_EMAIL);
    console.log("🔑 Password:", newPassword);
    console.log("🔐 New hash:", newHash.substring(0, 50) + "...");
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

resetPassword();
