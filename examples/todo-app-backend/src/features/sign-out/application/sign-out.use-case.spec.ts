import { SessionRepository } from '../../../modules/domain/session';
import { SessionRow, SessionRowStore } from '../../../modules/domain/session/session-row-store';
import { KeycloakClient } from '../../../modules/integrations/keycloak';
import { AppConfigService } from '../../../modules/platform/config';
import { SignOutUseCase } from './sign-out.use-case';

class FakeSessionStore implements SessionRowStore {
  private readonly byToken = new Map<string, SessionRow>();

  async findOneBy(where: { token: string }): Promise<SessionRow | null> {
    return this.byToken.get(where.token) ?? null;
  }

  async save(row: SessionRow): Promise<SessionRow> {
    this.byToken.set(row.token, row);
    return row;
  }

  async delete(token: string): Promise<unknown> {
    return this.byToken.delete(token);
  }
}

describe('SignOutUseCase', () => {
  it('br.login.session.restores: the session ends and the next request against that token is unauthenticated', async () => {
    const sessionRepository = new SessionRepository(new FakeSessionStore(), new AppConfigService());
    const session = await sessionRepository.tAccept('person-1');
    const keycloakClient = new KeycloakClient(new AppConfigService());
    jest.spyOn(keycloakClient, 'notifySignOut').mockResolvedValue(undefined);

    const useCase = new SignOutUseCase(sessionRepository, keycloakClient);
    const result = await useCase.execute({ sessionToken: session.token });

    expect(result.signedOut).toBe(true);
    await expect(sessionRepository.findActive(session.token)).rejects.toThrow();
  });
});
