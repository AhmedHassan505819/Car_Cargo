/**
 * Payment provider interface.
 * MVP: cash only. Designed for future gateways (JazzCash, Easypaisa).
 */

export interface PaymentResult {
  success: boolean;
  provider: string;
  providerRef?: string;
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;

  /** Initiate a payment (for digital providers). Cash is always pre-confirmed. */
  initiate(deliveryId: string, amount: number): Promise<PaymentResult>;

  /** Confirm the payment (rider confirms cash received). */
  confirm(deliveryId: string, providerRef?: string): Promise<PaymentResult>;

  /** Refund (not supported for cash MVP). */
  refund(deliveryId: string, providerRef?: string): Promise<PaymentResult>;
}
