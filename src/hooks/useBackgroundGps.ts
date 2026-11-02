import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

interface UseBackgroundGpsOptions {
  /** Interval in milliseconds (default: 30000 = 30 seconds) */
  interval?: number;
  /** Enable/disable GPS tracking */
  enabled?: boolean;
  /** High accuracy mode (default: true) */
  enableHighAccuracy?: boolean;
  /** Callback when GPS is captured */
  onPosition?: (position: GpsPosition) => void;
  /** Context identifier (e.g., 'pos-agent', 'delivery-hub', 'magic-link') */
  context?: string;
  /** Magic token for standalone endpoints (optional) */
  magicToken?: string;
  /** Public link ID for store/contract tracking without auth (optional) */
  publicLinkId?: string;
  /** Employee ID for POS agent tracking (optional) */
  employeeId?: string;
  /** Phone number for delivery hub order tracking (optional) */
  phoneNumber?: string;
}

/**
 * Custom hook for continuous GPS tracking in the background.
 * Uses Browser Geolocation API with periodic updates.
 * Works with both authenticated users (JWT) and magic-link users.
 *
 * @example
 * ```tsx
 * const { currentLocation, isTracking, error } = useBackgroundGps({
 *   interval: 30000,
 *   enabled: true,
 *   context: 'pos-agent',
 *   onPosition: (pos) => console.log('GPS:', pos)
 * });
 * ```
 */
export function useBackgroundGps(options: UseBackgroundGpsOptions = {}) {
  const {
    interval = 30000,
    enabled = true,
    enableHighAccuracy = true,
    onPosition,
    context = 'default',
    magicToken,
    publicLinkId,
    employeeId,
    phoneNumber,
  } = options;

  const { token } = useAuth();
  const [currentLocation, setCurrentLocation] = useState<GpsPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const sendGpsToServer = async (position: GpsPosition) => {
    if (!token && !magicToken && !publicLinkId && !phoneNumber) {
      console.warn('[useBackgroundGps] No authentication method available, skipping GPS send');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Use Authorization header for JWT, or query param for magic token
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = magicToken 
        ? `/api/gps/track?magic=${encodeURIComponent(magicToken)}` 
        : '/api/gps/track';

      // Only log for debugging, not spam
      if (process.env.NODE_ENV === 'development') {
        console.log('[useBackgroundGps] Sending GPS:', {
          phoneNumber,
          publicLinkId,
          context,
          hasToken: !!token,
          hasMagicToken: !!magicToken,
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          altitude: position.altitude,
          speed: position.speed,
          heading: position.heading,
          timestamp: position.timestamp,
          context,
          public_link_id: publicLinkId,
          employee_id: employeeId,
          phone_number: phoneNumber,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useBackgroundGps] Server error:', response.status, errorText);
      }
    } catch (err) {
      // Only log network errors once every minute to avoid spam
      if (error !== 'Network error') {
        console.error('[useBackgroundGps] Failed to send GPS to server:', err);
        setError('Network error');
      }
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('GPS not supported');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Use watchPosition for continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const gpsData: GpsPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
        };

        setCurrentLocation(gpsData);
        onPosition?.(gpsData);
        sendGpsToServer(gpsData);
      },
      (err) => {
        // Only log critical geolocation errors, skip unavailable/timeout
        if (err.code !== 2 && err.code !== 3) { // Skip unavailable and timeout errors
          console.error('[useBackgroundGps] Geolocation error:', {
            code: err.code,
            message: err.message,
          });
        }
        const errorMessage = err.code === 1 
          ? 'تم رفض إذن GPS' 
          : err.code === 2 
          ? 'غير متاح GPS' 
          : err.code === 3 
          ? 'انتهت مهلة GPS' 
          : 'خطأ في GPS';
        setError(errorMessage);
      },
      {
        enableHighAccuracy,
        timeout: 30000, // Increased from 10s to 30s
        maximumAge: 0,
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  };

  useEffect(() => {
    if (!enabled) {
      stopTracking();
      return;
    }

    startTracking();

    // Cleanup on unmount
    return () => {
      stopTracking();
    };
  }, [enabled, enableHighAccuracy, context, token, magicToken, employeeId, phoneNumber]);

  return {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
  };
}
