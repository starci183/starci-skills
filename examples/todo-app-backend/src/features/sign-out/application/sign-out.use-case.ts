import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SessionRepository } from '../../../modules/domain/session';
import { KeycloakClient } from '../../../modules/integrations/keycloak';
import { PlatformEventBus, SignedOutEvent } from '../../../modules/platform/events';
import { SignOutParams, SignOutResult } from './sign-out.contracts';

/**
 * fr.login.sign-out (composes br.login.session.restores): the session ends and the next request against
 * that token is unauthenticated. Revocation mirrors sds.login.session-store's t-revoke transition: the
 * row is deleted so the next read of that token finds nothing. event.login.signed-out is published after
 * the revoke succeeds, regardless of whether the best-effort remote Keycloak notification lands.
 */
@Injectable()
export class SignOutUseCase {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly keycloakClient: KeycloakClient,
    private readonly events: PlatformEventBus = new PlatformEventBus(),
  ) {}

  async execute(params: SignOutParams): Promise<SignOutResult> {
    const session = await this.sessionRepository.findActive(params.sessionToken);
    await this.sessionRepository.tRevoke(params.sessionToken);
    this.events.publish(new SignedOutEvent(session.personId, new Date(), randomUUID()));
    try {
      await this.keycloakClient.notifySignOut(session.personId);
    } catch {
      // Best-effort remote notification; the local revoke already happened and must not be undone by it.
    }
    return { signedOut: true };
  }
}
