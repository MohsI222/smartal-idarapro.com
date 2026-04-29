/**
 * Vercel Serverless entry — Express app with `/api/...` routes (`server/index.ts`).
 * `vercel.json` rewrites `/api/:path*` → `/api`; `vercelApiUrlRestore` restores the full path.
 */
import app from "../server/index.js";
export default app;
