import type { PaymentProvider, PaymentResult } from './provider';

/**
 * Cash payment provider.
 * The simplest provider: rider collects cash, confirms in the app.
 * No external API calls needed.
 */
export class CashProvider implements PaymentProvider {
  readonly name = 'cash';

  async initiate(_deliveryId: string, _amount: number): Promise<PaymentResult> {
    // Cash payments don't need initiation
    return { success: true, provider: this.name };
  }

  async confirm(deliveryId: string): Promise<PaymentResult> {
    // The actual DB write happens in the API route handler.
    // This provider just validates the flow.
    return {
      success: true,
      provider: this.name,
      providerRef: `cash-${deliveryId}-${Date.now()}`,
    };
  }

  async refund(_deliveryId: string): Promise<PaymentResult> {
    return {
      success: false,
      provider: this.name,
      error: 'Cash refunds must be handled manually',
    };
  }
}

export const cashProvider = new CashProvider();
