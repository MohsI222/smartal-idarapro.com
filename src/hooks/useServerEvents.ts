import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ServerEventOptions {
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  table?: string;
  enabled?: boolean;
}

export function useServerEvents({
  onInsert,
  onUpdate,
  onDelete,
  table,
  enabled = true
}: ServerEventOptions) {
  const { token } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;

    // Connect to SSE endpoint with token as query parameter
    // EventSource doesn't support custom headers, so we use query param
    const eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received event:', data);

        // Filter by table if specified
        if (table && data.table !== table) {
          console.log(`[SSE] Skipping event - table mismatch: data.table=${data.table}, expected=${table}`);
          return;
        }

        console.log(`[SSE] Processing event: ${data.event} for table: ${data.table}`);
        switch (data.event) {
          case 'INSERT':
            onInsert?.(data);
            break;
          case 'UPDATE':
            onUpdate?.(data);
            break;
          case 'DELETE':
            onDelete?.(data);
            break;
        }
      } catch (error) {
        console.error('[SSE] Error parsing event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      eventSource.close();
    };

    return () => {
      console.log('[SSE] Cleaning up connection');
      eventSource.close();
    };
  }, [token, table, onInsert, onUpdate, onDelete, enabled]);

  return {
    connected: eventSourceRef.current?.readyState === EventSource.OPEN
  };
}
