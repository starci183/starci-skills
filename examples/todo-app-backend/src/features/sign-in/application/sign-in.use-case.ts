import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InvalidCredentialsException, SessionRepository } from '../../../modules/domain/session';
import { KeycloakClient, KeycloakInvalidCredentialsException } from '../../../modules/integrations/keycloak';
import { PlatformEventBus, SignedInEvent } from '../../../modules/platform/events';
import { SignInParams, SignInResult } from './sign-in.contracts';

/**
 * br.login.password.sign-in: a sign-in succeeds only when Keycloak accepts the pair. Keycloak wins over
 * the earlier local-hash design (data.login.person, nfr.login.sign-in-timing's decoy hash): the product
 * never sees or stores a password, and the uniform refusal required by br.login.password.sign-in and
 * nfr.login.sign-in-timing comes from Keycloak's own direct access grant already answering an unknown
 * email and a wrong password with the same invalid_grant response, in one round-trip.
 */
@Injectable()
export class SignInUseCase {
  constructor(
    private readonly keycloakClient: KeycloakClient,
    private readonly sessionRepository: SessionRepository,
    private readonly events: PlatformEventBus = new PlatformEventBus(),
  ) {}

  async execute(params: SignInParams): Promise<SignInResult> {
    this.sessionRepository.tBegin(params.email);
    let personId: string;
    try {
      const result = await this.keycloakClient.signIn(params.email, params.password);
      personId = result.subject;
    } catch (error) {
      this.sessionRepository.tRefuse();
      if (error instanceof KeycloakInvalidCredentialsException) {
        throw new InvalidCredentialsException();
      }
      throw error;
    }
    const session = await this.sessionRepository.tAccept(personId);
    this.events.publish(new SignedInEvent(personId, session.issuedAt, randomUUID()));
    return { sessionToken: session.token, personId };
  }
}
