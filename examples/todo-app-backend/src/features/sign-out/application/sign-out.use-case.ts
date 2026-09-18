import { Injectable } from '@nestjs/common';
import { SessionRepository } from '../../../modules/domain/session';
import { KeycloakClient } from '../../../modules/integrations/keycloak';
import { SignOutParams, SignOutResult } from './sign-out.contracts';

/**
 * fr.login.sign-out (composes br.login.session.restores): the session ends and the next request against
 * that token is unauthenticated. Revocation mirrors sds.login.session-store's t-revoke transition: the
 * row is deleted so the next read of that token finds nothing.
 */
@Injectable()
export class SignOutUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly keycloakClient: KeycloakClient,
  ) {}

  async execute(params: SignOutParams): Promise<SignOutResult> {
    const session = this.sessionRepository.findActive(params.sessionToken);
    this.sessionRepository.tRevoke(params.sessionToken);
    try {
      await this.keycloakClient.notifySignOut(session.personId);
    } catch {
      // Best-effort remote notification; the local revoke already happened and must not be undone by it.
    }
    return { signedOut: true };
  }
}
