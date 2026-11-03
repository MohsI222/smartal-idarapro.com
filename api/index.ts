/**
 * Vercel Serverless entry — Express app with `/api/...` routes (`server/index.ts`).
 * `vercel.json` rewrites `/api/:path*` → `/api`; `vercelApiUrlRestore` restores the full path.
 *
 * deploy-bump: force Git/Vercel to pick up a fresh deployment (avoid stale Production pointer).
 */
import { initDatabase } from "../server/db";
import app from "../server/index";

// Initialize database on Vercel (serverless) - fire and forget
// initDatabase has internal promise caching to prevent multiple calls
initDatabase()
  .then(() => console.log("[api/index.ts] Database initialized successfully"))
  .catch((err) => console.error("[api/index.ts] Failed to initialize database:", err));

// Vercel requires the app to be exported as default
export default app;
