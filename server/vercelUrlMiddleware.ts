import type express from "express";

/**
 * When Vercel rewrites `/api/*` → `/api` for the single `api/index` handler, restore the real path
 * so Express routes mounted at `/api/...` keep matching.
 */
export function vercelApiUrlRestore(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): void {
  if (process.env.VERCEL !== "1") {
    next();
    return;
  }
  const raw =
    (typeof req.headers["x-vercel-original-url"] === "string" && req.headers["x-vercel-original-url"]) ||
    (typeof req.headers["x-invoke-path"] === "string" && req.headers["x-invoke-path"]) ||
    (typeof req.headers["x-vercel-invoke-path"] === "string" && req.headers["x-vercel-invoke-path"]) ||
    "";
  if (!raw) {
    next();
    return;
  }
  try {
    let pathname: string;
    let search = "";
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      pathname = u.pathname;
      search = u.search;
    } else {
      const q = raw.indexOf("?");
      const pathPart = q >= 0 ? raw.slice(0, q) : raw;
      search = q >= 0 ? raw.slice(q) : "";
      pathname = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
    }
    req.url = pathname + search;
  } catch {
    /* keep req.url */
  }
  next();
}
