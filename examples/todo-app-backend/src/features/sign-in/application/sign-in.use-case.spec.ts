import { Repository } from 'typeorm';
import { AppConfigService } from '../../../modules/platform/config';
import { SessionRepository } from '../../../modules/domain/session';
import { SessionEntity } from '../../../modules/integrations/postgres';
import { KeycloakClient, KeycloakInvalidCredentialsException, KeycloakSignInResult } from '../../../modules/integrations/keycloak';
import { PlatformEventBus, SignedInEvent } from '../../../modules/platform/events';
import { SignInUseCase } from './sign-in.use-case';

class FakeSessionRepository {
  private readonly byToken = new Map<string, SessionEntity>();

  async findOneBy(where: { token: string }): Promise<SessionEntity | null> {
    return this.byToken.get(where.token) ?? null;
  }

  async save(row: Partial<SessionEntity>): Promise<SessionEntity> {
    const entity = row as SessionEntity;
    this.byToken.set(entity.token, entity);
    return entity;
  }

  async delete(token: string): Promise<void> {
    this.byToken.delete(token);
  }
}

/**
 * The sign-in use case now exercises only the Keycloak client boundary: this fake stands in for the real
 * direct access grant round-trip, without asserting anything about how Keycloak itself is implemented.
 */
class FakeKeycloakClient extends KeycloakClient {
  constructor(private readonly accepted: Record<string, string>) {
    super(new AppConfigService());
  }

  async signIn(email: string, password: string): Promise<KeycloakSignInResult> {
    const key = email.toLowerCase();
    if (this.accepted[key] !== password) {
      throw new KeycloakInvalidCredentialsException();
    }
    return { subject: `subject-of-${key}` };
  }
}

describe('SignInUseCase', () => {
  let sessionRepository: SessionRepository;
  let useCase: SignInUseCase;

  beforeEach(() => {
    sessionRepository = new SessionRepository(new FakeSessionRepository() as unknown as Repository<SessionEntity>, new AppConfigService());
    const keycloakClient = new FakeKeycloakClient({ 'person@example.com': 'correct-horse' });
    useCase = new SignInUseCase(keycloakClient, sessionRepository);
  });

  it('ac.login.password.sign-in.wrong-pair-is-refused: a known email with a wrong password is refused and no session is created', async () => {
    await expect(useCase.execute({ email: 'person@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('br.login.password.sign-in: a sign-in succeeds only when Keycloak accepts the pair', async () => {
    const result = await useCase.execute({ email: 'person@example.com', password: 'correct-horse' });
    expect(result.sessionToken).toEqual(expect.any(String));
    expect(result.personId).toEqual(expect.any(String));
  });

  it('ac.login.password.sign-in.refusal-does-not-name-the-half: an unknown email and a wrong password carry the same refusal', async () => {
    let unknownEmailError: unknown;
    let wrongPasswordError: unknown;
    try {
      await useCase.execute({ email: 'nobody@example.com', password: 'anything' });
    } catch (error) {
      unknownEmailError = error;
    }
    try {
      await useCase.execute({ email: 'person@example.com', password: 'wrong-password' });
    } catch (error) {
      wrongPasswordError = error;
    }
    expect((unknownEmailError as Error).message).toBe((wrongPasswordError as Error).message);
    expect((unknownEmailError as { code: string }).code).toBe((wrongPasswordError as { code: string }).code);
  });

  it('sds.login.session-store t-accept: a successful sign-in writes one active session', async () => {
    const result = await useCase.execute({ email: 'person@example.com', password: 'correct-horse' });
    const session = await sessionRepository.findActive(result.sessionToken);
    expect(session.personId).toBe(result.personId);
  });

  it('event.login.signed-in: publishes on the PlatformEventBus after a successful sign-in', async () => {
    const events = new PlatformEventBus();
    const received: unknown[] = [];
    events.subscribe(event => received.push(event));
    const keycloakClient = new FakeKeycloakClient({ 'person@example.com': 'correct-horse' });
    const withEvents = new SignInUseCase(keycloakClient, sessionRepository, events);

    const result = await withEvents.execute({ email: 'person@example.com', password: 'correct-horse' });

    expect(received).toHaveLength(1);
    const [published] = received as [SignedInEvent];
    expect(published).toBeInstanceOf(SignedInEvent);
    expect(published.personId).toBe(result.personId);
  });

  it('a refused sign-in publishes nothing', async () => {
    const events = new PlatformEventBus();
    const received: unknown[] = [];
    events.subscribe(event => received.push(event));
    const keycloakClient = new FakeKeycloakClient({ 'person@example.com': 'correct-horse' });
    const withEvents = new SignInUseCase(keycloakClient, sessionRepository, events);

    await expect(withEvents.execute({ email: 'person@example.com', password: 'wrong' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(received).toHaveLength(0);
  });
});
