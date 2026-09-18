import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../platform/config';

export interface BuyerStatusResult {
  personId: string;
  hasOrders: boolean;
}

/**
 * The consumer half of contract.checkout.order-for-identity: does this person have orders?
 * A real HTTP call (global fetch) against the base URL AppConfigService resolves from
 * metadata.json - never a hardcoded port literal. An unreachable order service is a typed
 * 503 failure with a stable code, never an implied `hasOrders: false` - the contract says an
 * absent answer is not a no, and the caller must not retry into inventing one.
 */
@Injectable()
export class OrderApiClient {
  constructor(private readonly config: AppConfigService) {}

  async getBuyerStatus(personId: string): Promise<BuyerStatusResult> {
    const url = `${this.config.getOrderApiBaseUrl()}/buyers/${encodeURIComponent(personId)}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    } catch {
      throw new HttpException(
        { code: 'ORDER_SERVICE_UNAVAILABLE', message: 'The order service could not be reached.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (response.status === 404) return { personId, hasOrders: false };
    if (!response.ok) {
      throw new HttpException(
        { code: 'ORDER_SERVICE_UNAVAILABLE', message: `The order service answered ${response.status}.` },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const body = (await response.json()) as Partial<BuyerStatusResult>;
    if (body.personId !== personId || typeof body.hasOrders !== 'boolean') {
      throw new HttpException(
        { code: 'ORDER_CONTRACT_MISMATCH', message: 'The order service answered outside its contract.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { personId: body.personId, hasOrders: body.hasOrders };
  }
}
