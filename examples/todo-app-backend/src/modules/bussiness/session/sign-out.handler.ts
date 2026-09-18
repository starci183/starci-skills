import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { KeycloakClient } from '../../integrations/keycloak';
import { PlatformEventBus, SignedOutEvent } from '../../platform/events';
import { SessionService } from './session.service';
import { SignOutCommand, SignOutCommandResult } from './sign-out.command';

/**
 * fr.login.sign-out (composes br.login.session.restores): the session ends and the next request against
 * that token is unauthenticated. Revocation mirrors sds.login.session-store's t-revoke transition: the
 * row is deleted so the next read of that token finds nothing. event.login.signed-out is published after
 * the revoke succeeds, regardless of whether the best-effort remote Keycloak notification lands.
 *
 * Ported from the former `SignOutUseCase`; see sign-in.handler.ts's comment for the CQRS move.
 */
@Injectable()
@CommandHandler(SignOutCommand)
export class SignOutHandler implements ICommandHandler<SignOutCommand, SignOutCommandResult> {
  constructor(
    private readonly sessionService: SessionService,
    private readonly keycloakClient: KeycloakClient,
    private readonly events: PlatformEventBus,
  ) {}

  async execute(command: SignOutCommand): Promise<SignOutCommandResult> {
    const session = await this.sessionService.findActive(command.params.sessionToken);
    await this.sessionService.tRevoke(command.params.sessionToken);
    this.events.publish(new SignedOutEvent(session.personId, new Date(), randomUUID()));
    try {
      await this.keycloakClient.notifySignOut(session.personId);
    } catch {
      // Best-effort remote notification; the local revoke already happened and must not be undone by it.
    }
    return { signedOut: true };
  }
}
