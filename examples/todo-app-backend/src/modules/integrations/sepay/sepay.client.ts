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

/** SepayTransactionStatus as a runtime value: the gateway's own answer is only ever trustworthy as a
 * member of this closed vocabulary, because ReconcilePaymentHandler turns any status that is not
 * 'pending' or 'failed' straight into a subscription activation. */
const GATEWAY_STATUSES: readonly string[] = ['pending', 'paid', 'failed'];

/** fr.plan.reconcile's postcondition ("No pending intent is left unresolved forever") is not served by a
 * request that hangs: a gateway that never answers is a failed poll, reported as one. */
const REQUEST_TIMEOUT_MS = 15000;

/**
 * integration.plan.sepay: SePay owns the transfer, this product owns the subscription row that follows a
 * confirmed payment, keyed by SePay's payment intent id (gatewayIntentId). Modelled on the endpoints the
 * integration record names exactly (create-intent, get-transaction) - a real client class, never a fake
 * dressed up as one; see sepay.client.spec.ts for the in-process fake this module's own consumers unit
 * test against instead.
 *
 * gap.plan.sepay-not-reachable stays open until a call from this method actually reaches SePay's sandbox:
 * this class makes the real HTTP call every time, it never short-circuits to a canned response, and every
 * failure it reports carries the gateway's own status rather than a masked one.
 *
 * Measured against the real host from this machine on 2026-09-18 (see the gap/integration records and
 * examples/todo-app-backend/.starciwork/features/plan/integration/sepay/evidence.yaml): `my.sepay.vn`
 * answers, GET /userapi/transactions/details/:id is a real route that rejects a placeholder token with
 * 401, and the record's create-intent path POST /userapi/transactions/qr answers 404 like an unrouted
 * path does. So no call from here can complete a checkout today, and none is pretended to have.
 */
@Injectable()
export class SepayClient {
  constructor(private readonly config: AppConfigService) {}

  async createIntent(params: SepayCreateIntentParams): Promise<SepayCreateIntentResult> {
    const { status, payload } = await this.request('create-intent', '/userapi/transactions/qr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reference: params.subscriptionId,
        amount: params.amount,
        currency: params.currency,
      }),
    });
    const gatewayIntentId = payload.id;
    const checkoutUrl = payload.qrCodeUrl;
    if (typeof gatewayIntentId !== 'string' || !gatewayIntentId || typeof checkoutUrl !== 'string' || !checkoutUrl) {
      throw new Error(this.refusal('create-intent', status, 'the gateway returned no transaction id and checkout url'));
    }
    return { gatewayIntentId, checkoutUrl };
  }

  async getTransaction(gatewayIntentId: string): Promise<SepayGetTransactionResult> {
    const { status, payload } = await this.request('get-transaction', `/userapi/transactions/details/${encodeURIComponent(gatewayIntentId)}`, {
      method: 'GET',
    });
    const returnedStatus = payload.status;
    if (typeof returnedStatus !== 'string' || !GATEWAY_STATUSES.includes(returnedStatus)) {
      throw new Error(this.refusal('get-transaction', status, `the gateway returned the unrecognised status ${JSON.stringify(returnedStatus)}`));
    }
    const returnedPeriodEnd = payload.periodEnd;
    if (returnedPeriodEnd != null && typeof returnedPeriodEnd !== 'string' && typeof returnedPeriodEnd !== 'number') {
      throw new Error(this.refusal('get-transaction', status, 'the gateway returned a periodEnd that is not a date'));
    }
    const periodEnd = returnedPeriodEnd == null ? undefined : new Date(returnedPeriodEnd);
    if (periodEnd && Number.isNaN(periodEnd.getTime())) {
      throw new Error(this.refusal('get-transaction', status, `the gateway returned an unreadable periodEnd (${JSON.stringify(returnedPeriodEnd)})`));
    }
    return { status: returnedStatus as SepayTransactionStatus, periodEnd };
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

  private async request(name: string, path: string, init: RequestInit): Promise<{ status: number; payload: Record<string, unknown> }> {
    let response: Response;
    try {
      response = await fetch(`${this.config.getSepayBaseUrl()}${path}`, {
        ...init,
        headers: { accept: 'application/json', authorization: `Bearer ${this.config.getSepayApiKey()}`, ...init.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(this.refusal(name, undefined, `the request did not complete (${describeFetchFailure(error)})`));
    }
    // Read the body as text before parsing it: a gateway error page carries no JSON, and calling
    // response.json() on one threw a SyntaxError that buried the status code the caller needed. Measured
    // on the real host (an empty-body 404) on 2026-09-18.
    const body = await response.text();
    let payload: unknown;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      throw new Error(this.refusal(name, response.status, `the gateway returned a body that is not JSON (${preview(body)})`));
    }
    if (!response.ok || payload === null || typeof payload !== 'object') {
      throw new Error(this.refusal(name, response.status, preview(body)));
    }
    return { status: response.status, payload: payload as Record<string, unknown> };
  }

  /** Names what the gateway actually said, and whether a credential went out at all - the two facts
   * gap.plan.sepay-not-reachable turns on. Never the credential's value. */
  private refusal(name: string, status: number | undefined, detail: string): string {
    const credential = this.config.getSepayApiKey() ? 'a credential was sent' : 'no credential is configured';
    return `SePay ${name} failed: ${detail} (HTTP ${status ?? 'no response'}; ${credential}; ${this.config.getSepayBaseUrl()})`;
  }
}

function describeFetchFailure(error: unknown): string {
  if (error instanceof Error && error.name === 'TimeoutError') return `timed out after ${REQUEST_TIMEOUT_MS}ms`;
  // Read through a local shape rather than Error.cause: this project's TypeScript lib is ES2021, which
  // does not type `cause` at all.
  const failure = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  return failure?.cause?.code ?? failure?.cause?.message ?? failure?.message ?? String(error);
}

function preview(body: string): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 200)}…` : collapsed || 'empty body';
}
