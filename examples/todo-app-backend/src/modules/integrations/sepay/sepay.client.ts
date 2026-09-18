import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../platform/config';
import { PlanWebhookUnauthorizedException } from '@modules/shared/exceptions';

export interface SepayCreateIntentParams {
  readonly subscriptionId: string;
  readonly amount: number;
  readonly currency: string;
}

export interface SepayCreateIntentResult {
  /** SePay's own id for the created transaction; data.plan.payment-intent's gatewayIntentId. */
  readonly gatewayIntentId: string;
  /** Where the owner completes payment. */
  readonly checkoutUrl: string;
}

export type SepayTransactionStatus = 'pending' | 'paid' | 'failed';

export interface SepayGetTransactionResult {
  readonly status: SepayTransactionStatus;
  /** Only present once status is 'paid'. */
  readonly periodEnd?: Date;
}

/**
 * integration.plan.sepay: SePay owns the transfer, this product owns the subscription row that follows a
 * confirmed payment, keyed by SePay's payment intent id (gatewayIntentId). Modelled on the endpoints the
 * integration record names exactly (create-intent, get-transaction) - a real client class, never a fake
 * dressed up as one; see sepay.client.spec.ts for the in-process fake this module's own consumers unit
 * test against instead.
 *
 * gap.plan.sepay-not-reachable stays open until a call from this method actually reaches SePay's sandbox:
 * this class makes the real HTTP call every time, it never short-circuits to a canned response.
 */
@Injectable()
export class SepayClient {
  constructor(private readonly config: AppConfigService) {}

  async createIntent(params: SepayCreateIntentParams): Promise<SepayCreateIntentResult> {
    const response = await fetch(`${this.config.getSepayBaseUrl()}/userapi/transactions/qr`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.getSepayApiKey()}`,
      },
      body: JSON.stringify({
        reference: params.subscriptionId,
        amount: params.amount,
        currency: params.currency,
      }),
    });
    const payload = (await response.json()) as { id?: string; qrCodeUrl?: string };
    if (!response.ok || !payload.id || !payload.qrCodeUrl) {
      throw new Error(`SePay create-intent failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return { gatewayIntentId: payload.id, checkoutUrl: payload.qrCodeUrl };
  }

  async getTransaction(gatewayIntentId: string): Promise<SepayGetTransactionResult> {
    const response = await fetch(`${this.config.getSepayBaseUrl()}/userapi/transactions/details/${gatewayIntentId}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${this.config.getSepayApiKey()}` },
    });
    const payload = (await response.json()) as { status?: string; periodEnd?: string };
    if (!response.ok || !payload.status) {
      throw new Error(`SePay get-transaction failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return {
      status: payload.status as SepayTransactionStatus,
      periodEnd: payload.periodEnd ? new Date(payload.periodEnd) : undefined,
    };
  }

  /** fr.plan.upgrade's exception flow: an invalid webhook signature is ignored, never applied. SePay
   * authenticates its webhook delivery with a shared secret carried in the Authorization header
   * (integration.plan.sepay's credential), compared here rather than a computed body signature. */
  assertWebhookAuthorized(authorizationHeader: string | undefined): void {
    const expected = this.config.getSepayWebhookSecret();
    if (!expected || authorizationHeader !== `Bearer ${expected}`) {
      throw new PlanWebhookUnauthorizedException();
    }
  }
}
