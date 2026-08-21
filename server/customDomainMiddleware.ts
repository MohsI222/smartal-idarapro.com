/**
 * Custom Domain Middleware for Delivery Hub Stores
 * 
 * This middleware allows stores to be accessed via custom domains (e.g., clientdomain.com)
 * while maintaining full backward compatibility with the main domain and slug-based routing.
 * 
 * Logic:
 * 1. Extract the host from req.headers.host
 * 2. If it's the main domain or localhost, continue normally (fallback)
 * 3. If it's a custom domain, query the database for the store with that domain
 * 4. If found, attach store info to the request for downstream handlers
 * 5. If not found, continue normally (404 will be handled by the route)
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";

export interface CustomDomainRequest extends Request {
  customDomainStore?: {
    id: string;
    slug: string;
    name: string;
  };
}

/**
 * Get the main domain from environment variables
 * Defaults to localhost for development
 */
function getMainDomain(): string {
  const mainDomain = process.env.MAIN_DOMAIN || process.env.VERCEL_URL || "localhost";
  // Remove protocol and port for comparison
  return mainDomain
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
}

/**
 * Normalize hostname for comparison (remove port, www prefix)
 */
function normalizeHostname(hostname: string): string {
  return hostname
    .replace(/^www\./, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
}

/**
 * Middleware to handle custom domain routing for Delivery Hub stores
 */
export async function customDomainMiddleware(
  req: CustomDomainRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const host = req.headers.host;
  if (!host) {
    next();
    return;
  }

  const normalizedHost = normalizeHostname(host);
  const mainDomain = getMainDomain();

  // If it's the main domain or localhost, continue normally
  if (normalizedHost === mainDomain || normalizedHost === "localhost") {
    next();
    return;
  }

  // Check if it's a custom domain
  try {
    const store = await db
      .prepare(`
        SELECT id, slug, name 
        FROM public.delivery_hub_stores 
        WHERE custom_domain = ? 
        AND is_active = true
      `)
      .get(normalizedHost) as { id: string; slug: string; name: string } | undefined;

    if (store) {
      // Attach store info to request for downstream handlers
      req.customDomainStore = store;
      console.log(`[CustomDomain] Matched custom domain ${normalizedHost} to store ${store.slug}`);
    }
  } catch (error) {
    // Log error but don't block the request
    console.error("[CustomDomain] Error checking custom domain:", error);
  }

  // Continue to next middleware/route regardless
  next();
}
