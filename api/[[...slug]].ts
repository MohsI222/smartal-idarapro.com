/**
 * Serverless entry: all Express routes are defined with prefix `/api/...` in `server/index.ts`.
 * Same-origin fetches to `/api/...` (or `VITE_API_URL` when set) work after Vite + Vercel build.
 */
import app from "../server/index.js";
export default app;
