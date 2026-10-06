/**
 * Database types placeholder.
 * 
 * In production, generate these with:
 *   npx supabase gen types typescript --project-id <your-project-id> > types/database.types.ts
 * 
 * For now, we define the essential types manually to unblock development.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Enums matching the database
export type UserRole = 'sender' | 'rider' | 'admin';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type VehicleType = 'bike' | 'car' | 'van';
export type SizeClass = 'S' | 'M' | 'L';
export type DeliveryStatus =
  | 'SEARCHING'
  | 'ASSIGNED'
  | 'EN_ROUTE_TO_PICKUP'
  | 'AT_PICKUP'
  | 'IN_TRANSIT'
  | 'AT_DROPOFF'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';
export type DispatchResponse = 'pending' | 'accepted' | 'rejected' | 'expired';
export type PaymentProvider = 'cash' | 'manual_transfer';
export type PaymentStatus = 'pending' | 'confirmed' | 'disputed' | 'refunded';
export type LedgerEntryType = 'commission' | 'topup' | 'adjustment';
export type ReportType = 'damage' | 'theft' | 'misconduct' | 'late' | 'other';
export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

// Row types
export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface Rider {
  id: string;
  verification_status: VerificationStatus;
  cnic_photo_path: string | null;
  selfie_path: string | null;
  vehicle_type: VehicleType;
  plate_no: string | null;
  vehicle_photo_path: string | null;
  max_weight_kg: number;
  max_size_class: SizeClass;
  cash_balance_pkr: number;
  created_at: string;
  updated_at: string;
}

export interface RiderPresence {
  rider_id: string;
  status: 'online' | 'busy';
  location: unknown; // PostGIS geography
  accuracy_m: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

export interface Delivery {
  id: string;
  sender_id: string;
  rider_id: string | null;
  status: DeliveryStatus;
  pickup_location: unknown;
  pickup_address: string | null;
  pickup_landmark: string | null;
  dropoff_location: unknown;
  dropoff_address: string | null;
  dropoff_landmark: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  description: string;
  weight_kg: number;
  size_class: SizeClass;
  is_fragile: boolean;
  declared_value_pkr: number;
  photo_paths: string[];
  distance_km: number | null;
  suggested_price_pkr: number;
  price_pkr: number;
  pickup_otp_hash: string | null;
  delivery_otp_hash: string | null;
  tracking_token: string;
  cancelled_by: string | null;
  cancel_reason: string | null;
  dispatch_wave: number;
  created_at: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

export interface DeliveryOffer {
  id: string;
  delivery_id: string;
  rider_id: string;
  amount_pkr: number;
  status: string;
  created_at: string;
}

export interface DeliveryDispatch {
  delivery_id: string;
  rider_id: string;
  wave: number;
  sent_at: string;
  seen_at: string | null;
  response: DispatchResponse;
}

export interface DeliveryEvent {
  id: string;
  delivery_id: string;
  from_status: DeliveryStatus;
  to_status: DeliveryStatus;
  actor_id: string | null;
  meta: Json;
  created_at: string;
}

export interface DeliveryTrack {
  id: string;
  delivery_id: string;
  location: unknown;
  accuracy_m: number | null;
  recorded_at: string;
}

export interface Payment {
  id: string;
  delivery_id: string;
  provider: PaymentProvider;
  amount_pkr: number;
  payer: string;
  status: PaymentStatus;
  provider_ref: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  rider_id: string;
  delivery_id: string | null;
  type: LedgerEntryType;
  amount_pkr: number;
  note: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  delivery_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  delivery_id: string | null;
  reporter_id: string;
  reported_id: string | null;
  type: ReportType;
  description: string;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingConfig {
  id: number;
  base_fare_pkr: number;
  per_km_pkr: number;
  road_factor: number;
  weight_free_kg: number;
  per_extra_kg_pkr: number;
  size_fee_s_pkr: number;
  size_fee_m_pkr: number;
  size_fee_l_pkr: number;
  urgency_standard: number;
  urgency_asap: number;
  min_fare_pkr: number;
  sender_adjust_min_pct: number;
  sender_adjust_max_pct: number;
  night_rain_multiplier: number;
  night_rain_active: boolean;
  commission_pct: number;
  updated_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys: Json;
  created_at: string;
}

// Quote response from calculate_quote function
export interface QuoteResult {
  distance_km: number;
  suggested_price_pkr: number;
  min_price_pkr: number;
  max_price_pkr: number;
  breakdown: {
    base: number;
    distance_fee: number;
    weight_fee: number;
    size_fee: number;
    urgency_multiplier: number;
  };
}

// Supabase Database type (simplified for manual use)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; full_name: string };
        Update: Partial<Profile>;
      };
      riders: {
        Row: Rider;
        Insert: Partial<Rider> & { id: string };
        Update: Partial<Rider>;
      };
      rider_presence: {
        Row: RiderPresence;
        Insert: Partial<RiderPresence> & { rider_id: string; status: string; location: unknown };
        Update: Partial<RiderPresence>;
      };
      deliveries: {
        Row: Delivery;
        Insert: Partial<Delivery> & {
          sender_id: string;
          pickup_location: unknown;
          dropoff_location: unknown;
          description: string;
          weight_kg: number;
          suggested_price_pkr: number;
          price_pkr: number;
        };
        Update: Partial<Delivery>;
      };
      delivery_offers: {
        Row: DeliveryOffer;
        Insert: Partial<DeliveryOffer> & { delivery_id: string; rider_id: string; amount_pkr: number };
        Update: Partial<DeliveryOffer>;
      };
      delivery_dispatches: {
        Row: DeliveryDispatch;
        Insert: Partial<DeliveryDispatch> & { delivery_id: string; rider_id: string };
        Update: Partial<DeliveryDispatch>;
      };
      delivery_events: {
        Row: DeliveryEvent;
        Insert: Partial<DeliveryEvent> & { delivery_id: string; from_status: DeliveryStatus; to_status: DeliveryStatus };
        Update: Partial<DeliveryEvent>;
      };
      delivery_tracks: {
        Row: DeliveryTrack;
        Insert: Partial<DeliveryTrack> & { delivery_id: string; location: unknown };
        Update: Partial<DeliveryTrack>;
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & { delivery_id: string; amount_pkr: number; payer: string };
        Update: Partial<Payment>;
      };
      ledger_entries: {
        Row: LedgerEntry;
        Insert: Partial<LedgerEntry> & { rider_id: string; type: LedgerEntryType; amount_pkr: number };
        Update: Partial<LedgerEntry>;
      };
      ratings: {
        Row: Rating;
        Insert: Partial<Rating> & { delivery_id: string; rater_id: string; ratee_id: string; stars: number };
        Update: Partial<Rating>;
      };
      reports: {
        Row: Report;
        Insert: Partial<Report> & { reporter_id: string; type: ReportType; description: string };
        Update: Partial<Report>;
      };
      pricing_config: {
        Row: PricingConfig;
        Insert: Partial<PricingConfig>;
        Update: Partial<PricingConfig>;
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: Partial<PushSubscription> & { user_id: string; endpoint: string; keys: Json };
        Update: Partial<PushSubscription>;
      };
    };
    Functions: {
      nearby_riders: {
        Args: { p_lng: number; p_lat: number; p_radius_m: number; p_weight: number; p_size?: SizeClass };
        Returns: { rider_id: string; distance_m: number; rating_avg: number; vehicle: VehicleType }[];
      };
      dispatch_delivery: {
        Args: { p_delivery_id: string };
        Returns: number;
      };
      accept_delivery: {
        Args: { p_delivery_id: string; p_rider_id: string };
        Returns: Delivery;
      };
      transition_delivery: {
        Args: { p_id: string; p_to: DeliveryStatus; p_actor: string; p_actor_id: string; p_meta?: Json };
        Returns: Delivery;
      };
      verify_pickup_otp: {
        Args: { p_delivery_id: string; p_otp: string; p_rider_id: string };
        Returns: boolean;
      };
      verify_delivery_otp: {
        Args: { p_delivery_id: string; p_otp: string; p_rider_id: string };
        Returns: boolean;
      };
      calculate_quote: {
        Args: {
          p_pickup_lng: number;
          p_pickup_lat: number;
          p_dropoff_lng: number;
          p_dropoff_lat: number;
          p_weight_kg: number;
          p_size_class: SizeClass;
          p_urgency?: string;
        };
        Returns: QuoteResult;
      };
      get_delivery_by_token: {
        Args: { p_token: string };
        Returns: {
          id: string;
          status: DeliveryStatus;
          rider_first_name: string | null;
          rider_rating: number | null;
          pickup_landmark: string | null;
          dropoff_landmark: string | null;
          created_at: string;
          assigned_at: string | null;
          picked_up_at: string | null;
          delivered_at: string | null;
        }[];
      };
    };
  };
}
