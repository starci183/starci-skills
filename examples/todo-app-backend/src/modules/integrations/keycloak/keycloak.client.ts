import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../platform/config';
import { KeycloakUnavailableException } from './keycloak.exception';

/**
 * Keycloak is the identity provider named by integration.login.keycloak: this product never stores a
 * password on the provider's behalf. Sign-out best-effort notifies Keycloak so a revoked local session
 * does not leave a stale provider-side grant; a failure here never blocks the local revoke.
 */
@Injectable()
export class KeycloakClient {
  constructor(private readonly config: AppConfigService) {}

  async notifySignOut(personId: string): Promise<void> {
    const targetUrl = this.config.getKeycloakTokenUrl();
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'sign-out', personId }),
      });
    } catch (error) {
      throw new KeycloakUnavailableException(String(error));
    }
  }
}
