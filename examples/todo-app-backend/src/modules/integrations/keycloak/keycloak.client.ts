import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../platform/config';
import { KeycloakInvalidCredentialsException, KeycloakUnavailableException } from './keycloak.exception';

export interface KeycloakSignInResult {
  readonly subject: string;
}

/**
 * Keycloak is the identity provider named by integration.login.keycloak: this product never stores a
 * password on the provider's behalf. signIn() makes exactly one round-trip to the realm's token endpoint
 * (grant_type=password) whichever half of the pair is wrong - Keycloak's own direct access grant already
 * answers an unknown username and a wrong password with the same invalid_grant refusal, so this client
 * does not need a second call, a local hash or a decoy to keep that refusal uniform (br.login.password.sign-in,
 * nfr.login.sign-in-timing). The subject is read out of the access token it already received, so a
 * successful sign-in costs no further network round-trip either.
 *
 * Sign-out best-effort notifies Keycloak so a revoked local session does not leave a stale provider-side
 * grant; a failure here never blocks the local revoke.
 */
@Injectable()
export class KeycloakClient {
  constructor(private readonly config: AppConfigService) {}

  async signIn(email: string, password: string): Promise<KeycloakSignInResult> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.config.getKeycloakClientId(),
      username: email,
      password,
    });
    let response: Response;
    try {
      response = await fetch(this.config.getKeycloakTokenUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (error) {
      throw new KeycloakUnavailableException(String(error));
    }
    if (!response.ok) {
      // Keycloak's direct access grant answers an unknown username and a wrong password with the same
      // {error: "invalid_grant"} shape, so this refusal is already uniform without inspecting the body.
      throw new KeycloakInvalidCredentialsException();
    }
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) {
      throw new KeycloakInvalidCredentialsException();
    }
    return { subject: readSubject(payload.access_token) };
  }

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

/** Reads `sub` out of the access token's payload segment. No signature check: this client trusts the
 * transport-local Keycloak it just received the token from over TLS/loopback, not a bearer presented by
 * a third party. A resource server verifying a caller-presented token is a different, unwritten concern. */
function readSubject(accessToken: string): string {
  const segments = accessToken.split('.');
  if (segments.length < 2) {
    throw new KeycloakInvalidCredentialsException();
  }
  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as { sub?: string };
    if (!payload.sub) {
      throw new KeycloakInvalidCredentialsException();
    }
    return payload.sub;
  } catch {
    throw new KeycloakInvalidCredentialsException();
  }
}
