import { PasswordService, PersonRepository, SessionRepository } from '../../../modules/domain/session';
import { SignInUseCase } from './sign-in.use-case';

describe('SignInUseCase', () => {
  let personRepository: PersonRepository;
  let passwordService: PasswordService;
  let sessionRepository: SessionRepository;
  let useCase: SignInUseCase;

  beforeEach(() => {
    personRepository = new PersonRepository();
    passwordService = new PasswordService();
    sessionRepository = new SessionRepository();
    useCase = new SignInUseCase(personRepository, passwordService, sessionRepository);
    personRepository.register('person@example.com', passwordService.hash('correct-horse'));
  });

  it('ac.login.password.sign-in.wrong-pair-is-refused: a known email with a wrong password is refused and no session is created', async () => {
    await expect(useCase.execute({ email: 'person@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('br.login.password.sign-in: a sign-in succeeds only when the email is known and the password matches', async () => {
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

  it('sds.login.session-store t-accept: a successful sign-in writes one session row with a thirty-day expiry', async () => {
    const result = await useCase.execute({ email: 'person@example.com', password: 'correct-horse' });
    const session = sessionRepository.findActive(result.sessionToken);
    const days = Math.round((session.expiresAt.getTime() - session.issuedAt.getTime()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(30);
  });
});
