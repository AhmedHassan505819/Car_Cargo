'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGeolocation } from './useGeolocation';
import { useWakeLock } from './useWakeLock';
import { isAccurateEnough, isTeleport } from '@/lib/geo';

interface HeartbeatState {
  isOnline: boolean;
  isSending: boolean;
  lastSentAt: number | null;
  error: string | null;
}

interface UseRiderHeartbeatOptions {
  /** Rider must be approved and authenticated */
  riderId: string | null;
  /** Whether the rider has toggled "online" */
  enabled: boolean;
  /** Whether the rider is on an active delivery (higher accuracy) */
  isActiveDelivery?: boolean;
  /** Active delivery ID for broadcasting location */
  deliveryId?: string | null;
}

/**
 * Rider heartbeat hook.
 * - Manages the rider's online presence with adaptive intervals
 * - Uses Wake Lock to keep the screen on
 * - Queues pings when offline and flushes on reconnect
 * - Broadcasts location on the delivery channel during active deliveries
 * 
 * Intervals per spec Section 6.3:
 *   - Online, idle:  every 20-30s, enableHighAccuracy: false
 *   - Active delivery: every 5-10s, enableHighAccuracy: true
 */
export function useRiderHeartbeat(options: UseRiderHeartbeatOptions) {
  const { riderId, enabled, isActiveDelivery = false, deliveryId = null } = options;

  const [state, setState] = useState<HeartbeatState>({
    isOnline: false,
    isSending: false,
    lastSentAt: null,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const queueRef = useRef<Array<{ lat: number; lng: number; accuracy: number; heading: number | null; speed: number | null; ts: number }>>([]);

  const supabase = createClient();

  // Adaptive geolocation: high accuracy only during active deliveries
  const geo = useGeolocation({
    enableHighAccuracy: isActiveDelivery,
    maxAge: isActiveDelivery ? 5000 : 20000,
    timeout: 10000,
    watch: enabled,
  });

  const wakeLock = useWakeLock();

  // Send a single heartbeat to the server
  const sendHeartbeat = useCallback(
    async (lat: number, lng: number, accuracy: number, heading: number | null, speed: number | null) => {
      if (!riderId) return;

      // Skip inaccurate readings for matching purposes
      if (!isAccurateEnough(accuracy)) {
        console.warn(`GPS accuracy too low: ${accuracy}m, skipping heartbeat`);
        return;
      }

      // Teleport detection
      if (lastPositionRef.current) {
        const timeDelta = Date.now() - lastPositionRef.current.ts;
        if (
          isTeleport(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            lat,
            lng,
            timeDelta
          )
        ) {
          console.warn('Possible teleport detected, flagging');
          // Still send but flag it
        }
      }

      setState((prev) => ({ ...prev, isSending: true }));

      try {
        const { error } = await supabase.rpc('', {} as any); // Placeholder — we use the API route

        // Use the API route for heartbeat (server validates and upserts)
        const res = await fetch('/api/rider/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            accuracy,
            heading,
            speed,
            ts: Date.now(),
          }),
        });

        if (!res.ok) {
          throw new Error(`Heartbeat failed: ${res.status}`);
        }

        lastPositionRef.current = { lat, lng, ts: Date.now() };

        setState((prev) => ({
          ...prev,
          isSending: false,
          lastSentAt: Date.now(),
          error: null,
        }));

        // Broadcast on delivery channel during active delivery
        if (isActiveDelivery && deliveryId) {
          await supabase.channel(`delivery:${deliveryId}`).send({
            type: 'broadcast',
            event: 'rider:location',
            payload: { lat, lng, heading, speed, ts: Date.now() },
          });
        }
      } catch (err: any) {
        // Queue for retry
        queueRef.current.push({
          lat, lng, accuracy,
          heading, speed,
          ts: Date.now(),
        });

        setState((prev) => ({
          ...prev,
          isSending: false,
          error: err.message || 'Failed to send heartbeat',
        }));
      }
    },
    [riderId, isActiveDelivery, deliveryId, supabase]
  );

  // Flush queued pings on reconnect
  const flushQueue = useCallback(async () => {
    if (queueRef.current.length === 0) return;

    const queue = [...queueRef.current];
    queueRef.current = [];

    // Send only the latest ping (server only cares about current position)
    const latest = queue[queue.length - 1];
    await sendHeartbeat(latest.lat, latest.lng, latest.accuracy, latest.heading, latest.speed);
  }, [sendHeartbeat]);

  // Go online
  const goOnline = useCallback(async () => {
    if (!riderId) return;

    try {
      const res = await fetch('/api/rider/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: geo.position?.lat,
          lng: geo.position?.lng,
          accuracy: geo.accuracy,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to go online');
      }

      setState((prev) => ({ ...prev, isOnline: true, error: null }));

      // Activate wake lock
      if (wakeLock.isSupported) {
        wakeLock.request();
      }
    } catch (err: any) {
      setState((prev) => ({ ...prev, error: err.message }));
    }
  }, [riderId, geo.position, geo.accuracy, wakeLock]);

  // Go offline
  const goOffline = useCallback(async () => {
    if (!riderId) return;

    try {
      await fetch('/api/rider/offline', {
        method: 'POST',
      });
    } catch {
      // Best effort
    }

    setState({ isOnline: false, isSending: false, lastSentAt: null, error: null });

    // Release wake lock
    wakeLock.release();

    // Stop watching
    geo.stopWatching();
  }, [riderId, wakeLock, geo]);

  // Heartbeat interval — adaptive based on delivery state
  useEffect(() => {
    if (!enabled || !geo.position || !riderId) return;

    const intervalMs = isActiveDelivery ? 5000 : 20000;

    // Send immediately
    sendHeartbeat(
      geo.position.lat,
      geo.position.lng,
      geo.accuracy || 100,
      geo.heading,
      geo.speed
    );

    intervalRef.current = setInterval(() => {
      if (geo.position) {
        sendHeartbeat(
          geo.position.lat,
          geo.position.lng,
          geo.accuracy || 100,
          geo.heading,
          geo.speed
        );
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, isActiveDelivery, geo.position, geo.accuracy, geo.heading, geo.speed, riderId, sendHeartbeat]);

  // Online listener — flush queue on reconnect
  useEffect(() => {
    const handleOnline = () => {
      flushQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushQueue]);

  // Start/stop geolocation watching based on enabled state
  useEffect(() => {
    if (enabled) {
      geo.startWatching();
    } else {
      geo.stopWatching();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    ...state,
    position: geo.position,
    accuracy: geo.accuracy,
    wakeLockActive: wakeLock.isActive,
    goOnline,
    goOffline,
  };
}
