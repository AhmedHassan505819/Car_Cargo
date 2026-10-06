import type { SizeClass, QuoteResult } from '@/types/database.types';

/**
 * Client-side quote calculation for immediate feedback.
 * The server function (calculate_quote) is the source of truth;
 * this mirrors the logic for instant UI updates.
 */

interface PricingParams {
  pickupLng: number;
  pickupLat: number;
  dropoffLng: number;
  dropoffLat: number;
  weightKg: number;
  sizeClass: SizeClass;
  urgency?: 'standard' | 'asap';
}

// Default pricing config (matches DB seed)
const DEFAULT_CONFIG = {
  baseFare: 80,
  perKm: 25,
  roadFactor: 1.3,
  weightFreeKg: 2,
  perExtraKg: 15,
  sizeFeeS: 0,
  sizeFeeM: 40,
  sizeFeeL: 100,
  urgencyStandard: 1.0,
  urgencyAsap: 1.25,
  minFare: 120,
  senderAdjustMinPct: -15,
  senderAdjustMaxPct: 50,
};

/**
 * Haversine distance in kilometers between two lat/lng points.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate a price quote (client-side preview).
 */
export function calculateQuote(params: PricingParams): QuoteResult {
  const config = DEFAULT_CONFIG;

  const straightKm = haversineDistanceKm(
    params.pickupLat,
    params.pickupLng,
    params.dropoffLat,
    params.dropoffLng
  );

  const estRoadKm = straightKm * config.roadFactor;

  const sizeFee =
    params.sizeClass === 'S'
      ? config.sizeFeeS
      : params.sizeClass === 'M'
      ? config.sizeFeeM
      : config.sizeFeeL;

  const urgencyMult =
    params.urgency === 'asap' ? config.urgencyAsap : config.urgencyStandard;

  let price =
    (config.baseFare +
      config.perKm * estRoadKm +
      config.perExtraKg * Math.max(0, params.weightKg - config.weightFreeKg) +
      sizeFee) *
    urgencyMult;

  // Round to nearest 10
  price = Math.round(price / 10) * 10;

  // Floor at min fare
  price = Math.max(price, config.minFare);

  const minPrice = Math.round(price * (1 + config.senderAdjustMinPct / 100));
  const maxPrice = Math.round(price * (1 + config.senderAdjustMaxPct / 100));

  return {
    distance_km: Math.round(estRoadKm * 100) / 100,
    suggested_price_pkr: price,
    min_price_pkr: minPrice,
    max_price_pkr: maxPrice,
    breakdown: {
      base: config.baseFare,
      distance_fee: Math.round(config.perKm * estRoadKm),
      weight_fee: Math.round(
        config.perExtraKg * Math.max(0, params.weightKg - config.weightFreeKg)
      ),
      size_fee: sizeFee,
      urgency_multiplier: urgencyMult,
    },
  };
}
