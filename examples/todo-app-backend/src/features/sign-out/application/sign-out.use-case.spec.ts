import { PasswordService, PersonRepository, SessionRepository } from '../../../modules/domain/session';
import { KeycloakClient } from '../../../modules/integrations/keycloak';
import { AppConfigService } from '../../../modules/platform/config';
import { SignOutUseCase } from './sign-out.use-case';

describe('SignOutUseCase', () => {
  it('br.login.session.restores: the session ends and the next request against that token is unauthenticated', async () => {
    const sessionRepository = new SessionRepository();
    const personRepository = new PersonRepository();
    const passwordService = new PasswordService();
    const person = personRepository.register('person@example.com', passwordService.hash('correct-horse'));
    const session = sessionRepository.tAccept(person.id);
    const keycloakClient = new KeycloakClient(new AppConfigService());
    jest.spyOn(keycloakClient, 'notifySignOut').mockResolvedValue(undefined);

    const useCase = new SignOutUseCase(sessionRepository, keycloakClient);
    const result = await useCase.execute({ sessionToken: session.token });

    expect(result.signedOut).toBe(true);
    expect(() => sessionRepository.findActive(session.token)).toThrow();
  });
});
