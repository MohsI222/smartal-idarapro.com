/**
 * Online/Offline status indicator with auto background sync
 * Shows connection status and syncs pending operations when connection is restored
 */
import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  getPendingOperations,
  deletePendingOperation,
  incrementRetryCount,
  type PendingOperation
} from '@/lib/offlineStorage';
import { api } from '@/lib/api';

export function OnlineStatusIndicator() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Check initial pending operations count
    updatePendingCount();

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('🟢 تم استعادة الاتصال بالإنترنت');
      syncPendingOperations();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('🟠 انقطع الاتصال بالإنترنت - العمل في وضع عدم الاتصال');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic sync check (every 30 seconds when online)
    const syncInterval = setInterval(() => {
      if (isOnline && !isSyncing) {
        updatePendingCount();
        if (pendingCount > 0) {
          syncPendingOperations();
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [isOnline, isSyncing, pendingCount]);

  const updatePendingCount = async () => {
    try {
      const pending = await getPendingOperations();
      setPendingCount(pending.length);
    } catch (error) {
      console.error('Failed to check pending operations:', error);
    }
  };

  const syncPendingOperations = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      const pending = await getPendingOperations();
      
      if (pending.length === 0) {
        return;
      }

      toast.info(`جاري مزامنة ${pending.length} عملية معلقة...`);

      for (const operation of pending) {
        try {
          await processOperation(operation);
          await deletePendingOperation(operation.id);
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
          await incrementRetryCount(operation.id);
          
          // Remove operations that have failed too many times (5 retries)
          if (operation.retryCount >= 5) {
            await deletePendingOperation(operation.id);
            toast.error(`فشلت مزامنة العملية بعد عدة محاولات: ${operation.type}`);
          }
        }
      }

      await updatePendingCount();
      toast.success('✅ تمت المزامنة بنجاح');
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('فشلت المزامنة - سيتم إعادة المحاولة لاحقاً');
    } finally {
      setIsSyncing(false);
    }
  };

  const processOperation = async (operation: PendingOperation) => {
    const token = localStorage.getItem('auth_token');
    
    switch (operation.type) {
      case 'create_order':
        await api('/delivery-hub/orders', {
          method: 'POST',
          token,
          body: JSON.stringify(operation.payload),
        });
        break;
      
      case 'update_order_status':
        await api(`/delivery-hub/orders/${operation.payload.orderId}/status`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ status: operation.payload.status }),
        });
        break;
      
      case 'update_product':
        await api(`/delivery-hub/products/${operation.payload.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(operation.payload),
        });
        break;
      
      case 'create_product':
        await api('/delivery-hub/products', {
          method: 'POST',
          token,
          body: JSON.stringify(operation.payload),
        });
        break;
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  };

  if (isOnline && pendingCount === 0) {
    return null; // Don't show indicator when online with no pending operations
  }

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-sm transition-all duration-300"
      style={{
        backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.9)' : 'rgba(249, 115, 22, 0.9)',
        color: 'white',
      }}
    >
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      <span>
        {isOnline ? 'أونلاين' : 'أوفلاين'}
      </span>
      {pendingCount > 0 && (
        <>
          <span className="mx-1">•</span>
          <span>{pendingCount} عملية معلقة</span>
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <button
              onClick={syncPendingOperations}
              className="ml-1 hover:opacity-80 transition-opacity"
              title="مزامنة الآن"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
