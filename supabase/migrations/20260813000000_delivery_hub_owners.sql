-- ============================================================================
-- Delivery Hub Owners Table
-- Maps app user IDs to internal delivery hub owner IDs for RLS bypass
-- This table is used by the trusted backend (server/deliveryHubRoutes.ts)
-- to manage ownership without relying on Supabase Auth sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_hub_owners (
  app_user_id TEXT PRIMARY KEY,
  owner_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_hub_owners_owner ON public.delivery_hub_owners(owner_id);

-- Enable Row Level Security
ALTER TABLE public.delivery_hub_owners ENABLE ROW LEVEL SECURITY;

-- Policy: Only the backend can manage this table (service role)
-- Since the backend bypasses RLS via direct connection, no public policies needed
