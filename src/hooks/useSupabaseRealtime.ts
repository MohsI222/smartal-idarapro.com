import { useEffect, useRef, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

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
 */
export function useSupabaseRealtime(config: RealtimeSubscriptionConfig, enabled: boolean = true) {
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = getSupabaseClient();

  const { table, filter, events = ["INSERT", "UPDATE", "DELETE"], onInsert, onUpdate, onDelete } = config;

  // Memoize callbacks to prevent unnecessary re-subscriptions
  const handleInsert = useCallback((payload: any) => {
    if (onInsert) onInsert(payload);
  }, [onInsert]);

  const handleUpdate = useCallback((payload: any) => {
    if (onUpdate) onUpdate(payload);
  }, [onUpdate]);

  const handleDelete = useCallback((payload: any) => {
    if (onDelete) onDelete(payload);
  }, [onDelete]);

  useEffect(() => {
    if (!enabled || !supabase) {
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Create a unique channel name based on table and filter
    const channelName = filter 
      ? `realtime-${table}-${filter.replace(/[^a-zA-Z0-9]/g, '-')}`
      : `realtime-${table}`;

    const subscribe = () => {
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter,
          },
          (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            if (eventType === "INSERT" && events.includes("INSERT")) {
              handleInsert(newRecord);
            } else if (eventType === "UPDATE" && events.includes("UPDATE")) {
              handleUpdate(newRecord);
            } else if (eventType === "DELETE" && events.includes("DELETE")) {
              handleDelete(oldRecord);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log(`[Realtime] Successfully subscribed to ${table}${filter ? ` with filter: ${filter}` : ''}`);
          } else if (status === "CHANNEL_ERROR") {
            console.error(`[Realtime] Error subscribing to ${table}:`, err);
            // Auto-reconnect after 3 seconds on channel error
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(`[Realtime] Attempting to reconnect to ${table}...`);
              subscribe();
            }, 3000);
          } else if (status === "TIMED_OUT") {
            console.warn(`[Realtime] Subscription to ${table} timed out, attempting reconnect...`);
            // Auto-reconnect after 2 seconds on timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(`[Realtime] Attempting to reconnect to ${table}...`);
              subscribe();
            }, 2000);
          } else if (status === "CLOSED") {
            console.log(`[Realtime] Channel ${table} closed`);
          }
        });

      channelRef.current = channel;
    };

    subscribe();

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (channelRef.current && supabase) {
        console.log(`[Realtime] Cleaning up subscription to ${table}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, events, enabled, handleInsert, handleUpdate, handleDelete, supabase]);

  return channelRef;
}

/**
 * Hook for subscribing to inventory table changes
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
      table: "inventory",
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
 * SECURITY: No filter to see all employees in the organization
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
      filter: undefined, // No filter to see all employees
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
 * This is used for admin views where all employees need to be visible
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
      filter: undefined, // No filter to see all employees
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert,
      onUpdate,
      onDelete,
    },
    enabled
  );
}
