'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DeliveryStatus } from '@/types/database.types';

interface DeliveryChannelState {
  riderLocation: { lat: number; lng: number; heading?: number; speed?: number; ts: number } | null;
  status: DeliveryStatus | null;
  lastUpdate: number | null;
}

interface UseDeliveryChannelOptions {
  deliveryId: string | null;
  enabled?: boolean;
  /** Poll interval as a fallback (default: 10s) */
  pollIntervalMs?: number;
}

/**
 * Hook to subscribe to a delivery's realtime updates.
 * Combines Supabase Realtime (postgres_changes + broadcast) with a polling fallback.
 */
export function useDeliveryChannel(options: UseDeliveryChannelOptions) {
  const { deliveryId, enabled = true, pollIntervalMs = 10000 } = options;

  const [state, setState] = useState<DeliveryChannelState>({
    riderLocation: null,
    status: null,
    lastUpdate: null,
  });

  const supabase = createClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to delivery status changes
  useEffect(() => {
    if (!deliveryId || !enabled) return;

    const channel = supabase
      .channel(`delivery-watch:${deliveryId}`)
      // Status changes via postgres_changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          setState((prev) => ({
            ...prev,
            status: newRow.status,
            lastUpdate: Date.now(),
          }));
        }
      )
      // Rider location via broadcast
      .on('broadcast', { event: 'rider:location' }, (payload) => {
        setState((prev) => ({
          ...prev,
          riderLocation: payload.payload,
          lastUpdate: Date.now(),
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId, enabled, supabase]);

  // Polling fallback
  const fetchDelivery = useCallback(async () => {
    if (!deliveryId) return;

    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('status, rider_id')
        .eq('id', deliveryId)
        .single();

      if (!error && data) {
        setState((prev) => ({
          ...prev,
          status: data.status as DeliveryStatus,
          lastUpdate: Date.now(),
        }));
      }
    } catch {
      // Silent fail — realtime is primary
    }
  }, [deliveryId, supabase]);

  useEffect(() => {
    if (!deliveryId || !enabled) return;

    // Initial fetch
    fetchDelivery();

    // Polling fallback every N seconds
    pollRef.current = setInterval(fetchDelivery, pollIntervalMs);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [deliveryId, enabled, pollIntervalMs, fetchDelivery]);

  return state;
}
