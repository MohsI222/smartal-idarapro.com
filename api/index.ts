/**
 * Vercel Serverless entry — Express app with `/api/...` routes (`server/index.ts`).
 * `vercel.json` rewrites `/api/:path*` → `/api`; `vercelApiUrlRestore` restores the full path.
 *
 * deploy-bump: force Git/Vercel to pick up a fresh deployment (avoid stale Production pointer).
 */
import app from "../server/index.js";
export default app;
