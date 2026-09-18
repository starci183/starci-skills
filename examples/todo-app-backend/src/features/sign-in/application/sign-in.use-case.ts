import { Injectable } from '@nestjs/common';
import { InvalidCredentialsException, PasswordService, PersonRepository, SessionRepository } from '../../../modules/domain/session';
import { SignInParams, SignInResult } from './sign-in.contracts';

/**
 * br.login.password.sign-in: a sign-in succeeds only when the email is known and the password matches
 * its stored hash. The refusal for an unknown email must be indistinguishable from the refusal for a
 * known email with a wrong password, including in timing (nfr.login.sign-in-timing) - so the password
 * hash is always verified, against a fixed decoy when no person was found, rather than returning early.
 */
@Injectable()
export class SignInUseCase {
  constructor(
    private readonly personRepository: PersonRepository,
    private readonly passwordService: PasswordService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(params: SignInParams): Promise<SignInResult> {
    this.sessionRepository.tBegin(params.email);
    let personId: string | null = null;
    let hashToCompare = this.passwordService.getDecoyHash();
    try {
      const person = this.personRepository.findByEmail(params.email);
      personId = person.id;
      hashToCompare = person.passwordHash;
    } catch {
      personId = null;
    }
    try {
      this.passwordService.assertMatches(params.password, hashToCompare);
    } catch (error) {
      this.sessionRepository.tRefuse();
      throw error;
    }
    if (!personId) {
      this.sessionRepository.tRefuse();
      throw new InvalidCredentialsException();
    }
    const session = this.sessionRepository.tAccept(personId);
    return { sessionToken: session.token, personId };
  }
}
