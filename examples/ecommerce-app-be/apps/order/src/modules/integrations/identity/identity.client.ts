import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../platform/config';

export interface SessionPersonResult {
  personId: string;
}

/**
 * The order service's real HTTP client toward the identity service (its /sessions/verify door):
 * every authenticated checkout call passes through here, on a base URL resolved from
 * metadata.json - never a hardcoded port literal. A refused token answers null (the consumer
 * turns it into its own 401, same doctrine as todo's contract refusal propagation); an
 * unreachable identity answers a typed 503 - never a pass-through.
 */
@Injectable()
export class IdentityApiClient {
  constructor(private readonly config: AppConfigService) {}

  async verifySession(sessionToken: string): Promise<SessionPersonResult | null> {
    let response: Response;
    try {
      response = await fetch(`${this.config.getIdentityApiBaseUrl()}/sessions/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new HttpException(
        { code: 'IDENTITY_SERVICE_UNAVAILABLE', message: 'The identity service could not be reached.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (response.status === 401) return null;
    if (!response.ok) {
      throw new HttpException(
        { code: 'IDENTITY_SERVICE_UNAVAILABLE', message: `The identity service answered ${response.status}.` },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const body = (await response.json()) as Partial<SessionPersonResult>;
    if (typeof body.personId !== 'string' || !body.personId) {
      throw new HttpException(
        { code: 'IDENTITY_CONTRACT_MISMATCH', message: 'The identity service answered outside its contract.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { personId: body.personId };
  }

  /** The identity service's own /health - order's /health reports it as a dependency. */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.getIdentityApiBaseUrl()}/health`, { signal: AbortSignal.timeout(2000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
