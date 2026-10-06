import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to delivery status changes via postgres_changes.
 * Returns a channel that can be unsubscribed from.
 */
export function subscribeToDeliveryChanges(
  deliveryId: string,
  onStatusChange: (payload: { new: { status: string; rider_id: string | null } }) => void
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`delivery-status:${deliveryId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: `id=eq.${deliveryId}`,
      },
      (payload) => {
        onStatusChange(payload as any);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to rider dispatch notifications.
 * Fires when a new delivery_dispatch row is created for this rider.
 */
export function subscribeToRiderDispatches(
  riderId: string,
  onNewDispatch: (payload: any) => void
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`rider-dispatches:${riderId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'delivery_dispatches',
        filter: `rider_id=eq.${riderId}`,
      },
      (payload) => {
        onNewDispatch(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Broadcast rider location on the delivery channel (ephemeral).
 * Used during active deliveries for real-time tracking.
 */
export function broadcastRiderLocation(
  deliveryId: string,
  location: { lat: number; lng: number; heading?: number; speed?: number }
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase.channel(`delivery:${deliveryId}`);

  channel.send({
    type: 'broadcast',
    event: 'rider:location',
    payload: {
      ...location,
      ts: Date.now(),
    },
  });

  return channel;
}

/**
 * Subscribe to rider location broadcasts on a delivery channel.
 */
export function subscribeToRiderLocation(
  deliveryId: string,
  onLocation: (location: { lat: number; lng: number; heading?: number; speed?: number; ts: number }) => void
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`delivery:${deliveryId}`)
    .on('broadcast', { event: 'rider:location' }, (payload) => {
      onLocation(payload.payload);
    })
    .subscribe();

  return channel;
}
