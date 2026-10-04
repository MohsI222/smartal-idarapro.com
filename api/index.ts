/**
 * Vercel Serverless entry — Express app with `/api/...` routes (`server/index.ts`).
 * `vercel.json` rewrites `/api/:path*` → `/api`; `vercelApiUrlRestore` restores the full path.
 *
 * deploy-bump: force Git/Vercel to pick up a fresh deployment (avoid stale Production pointer).
 */
import { initDatabase } from "../server/db.js";
import app from "../server/index.js";

// Initialize database on Vercel (serverless)
initDatabase().catch((err) => {
  console.error("[api/index.ts] Failed to initialize database:", err);
});

export default app;
