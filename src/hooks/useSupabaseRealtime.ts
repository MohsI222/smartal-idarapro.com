import { useEffect, useRef, useCallback } from "react";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

interface RealtimeSubscriptionConfig {
  table: string;
  filter?: string;
  events?: RealtimeEvent[];
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

/**
 * Custom hook for managing Supabase Realtime subscriptions with automatic cleanup and auto-reconnect.
 * This hook ensures subscriptions are properly cleaned up when the component unmounts
 * to prevent memory leaks and performance issues.
 *
 * NOTE: Supabase Realtime has been removed. This hook is now a no-op.
 * Use polling mechanisms instead for real-time updates.
 */
export function useSupabaseRealtime(config: RealtimeSubscriptionConfig, enabled: boolean = true) {
  // No-op - Supabase Realtime removed
  return useRef<any>(null);
}

/**
 * Hook for subscribing to inventory_products table changes
 * SECURITY: Filters by user_id to ensure data isolation
 */
export function useInventoryRealtime(
  userId: string,
  onInsert?: (item: any) => void,
  onUpdate?: (item: any) => void,
  onDelete?: (item: any) => void,
  enabled: boolean = true
) {
  return useSupabaseRealtime(
    {
      table: "inventory_products",
      filter: userId ? `user_id=eq.${userId}` : undefined,
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}

/**
 * Hook for subscribing to production_requests table changes
 * SECURITY: Filters by user_id to ensure data isolation
 */
export function useProductionRequestsRealtime(
  userId: string,
  onInsert?: (request: any) => void,
  onUpdate?: (request: any) => void,
  onDelete?: (request: any) => void,
  enabled: boolean = true
) {
  return useSupabaseRealtime(
    {
      table: "production_requests",
      filter: userId ? `user_id=eq.${userId}` : undefined,
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}

/**
 * Hook for subscribing to logistics_queue table changes
 * SECURITY: Filters by user_id to ensure data isolation
 */
export function useLogisticsQueueRealtime(
  userId: string,
  onInsert?: (item: any) => void,
  onUpdate?: (item: any) => void,
  onDelete?: (item: any) => void,
  enabled: boolean = true
) {
  return useSupabaseRealtime(
    {
      table: "logistics_queue",
      filter: userId ? `user_id=eq.${userId}` : undefined,
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}

/**
 * Hook for subscribing to delivery_hub_orders table changes
 */
export function useDeliveryOrdersRealtime(
  storeId: string,
  onInsert?: (order: any) => void,
  onUpdate?: (order: any) => void,
  onDelete?: (order: any) => void,
  enabled: boolean = true
) {
  return useSupabaseRealtime(
    {
      table: "delivery_hub_orders",
      filter: `store_id=eq.${storeId}`,
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}

/**
 * Hook for subscribing to delivery_hub_products table changes
 */
export function useDeliveryProductsRealtime(
  storeId: string,
  onInsert?: (product: any) => void,
  onUpdate?: (product: any) => void,
  onDelete?: (product: any) => void,
  enabled: boolean = true
) {
  return useSupabaseRealtime(
    {
      table: "delivery_hub_products",
      filter: `store_id=eq.${storeId}`,
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}

/**
 * Hook for subscribing to hr_employees table changes
 * SECURITY: Filters by user_id to ensure data isolation - each user only sees their own employees
 */
export function useHrEmployeesRealtime(
  userId: string,
  onInsert?: (employee: any) => void,
  onUpdate?: (employee: any) => void,
  onDelete?: (employee: any) => void,
  enabled: boolean = true
) {
  return useSupabaseRealtime(
    {
      table: "hr_employees",
      filter: userId ? `user_id=eq.${userId}` : undefined,
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}

/**
 * Hook for subscribing to hr_employees table changes without user_id filter
 * SECURITY WARNING: This should ONLY be used by Super Admin (lahcenm534@gmail.com)
 * Regular users should never use this hook as it would expose all employees across all tenants
 */
export function useHrEmployeesRealtimeAll(
  onInsert?: (employee: any) => void,
  onUpdate?: (employee: any) => void,
  onDelete?: (employee: any) => void,
  enabled: boolean = true
) {
  return useSupabaseRealtime(
    {
      table: "hr_employees",
      filter: undefined, // No filter - Super Admin only
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}
