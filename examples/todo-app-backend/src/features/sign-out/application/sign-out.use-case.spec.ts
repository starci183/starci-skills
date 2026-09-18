import { Repository } from 'typeorm';
import { SessionRepository } from '../../../modules/domain/session';
import { SessionEntity } from '../../../modules/integrations/postgres';
import { KeycloakClient } from '../../../modules/integrations/keycloak';
import { AppConfigService } from '../../../modules/platform/config';
import { PlatformEventBus, SignedOutEvent } from '../../../modules/platform/events';
import { SignOutUseCase } from './sign-out.use-case';

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

describe('SignOutUseCase', () => {
  it('br.login.session.restores: the session ends and the next request against that token is unauthenticated', async () => {
    const sessionRepository = new SessionRepository(
      new FakeSessionRepository() as unknown as Repository<SessionEntity>,
      new AppConfigService(),
    );
    const session = await sessionRepository.tAccept('person-1');
    const keycloakClient = new KeycloakClient(new AppConfigService());
    jest.spyOn(keycloakClient, 'notifySignOut').mockResolvedValue(undefined);

    const useCase = new SignOutUseCase(sessionRepository, keycloakClient);
    const result = await useCase.execute({ sessionToken: session.token });

    expect(result.signedOut).toBe(true);
    await expect(sessionRepository.findActive(session.token)).rejects.toThrow();
  });

  it('event.login.signed-out: publishes on the PlatformEventBus after the session is revoked', async () => {
    const sessionRepository = new SessionRepository(
      new FakeSessionRepository() as unknown as Repository<SessionEntity>,
      new AppConfigService(),
    );
    const session = await sessionRepository.tAccept('person-1');
    const keycloakClient = new KeycloakClient(new AppConfigService());
    jest.spyOn(keycloakClient, 'notifySignOut').mockResolvedValue(undefined);
    const events = new PlatformEventBus();
    const received: unknown[] = [];
    events.subscribe(event => received.push(event));

    const useCase = new SignOutUseCase(sessionRepository, keycloakClient, events);
    await useCase.execute({ sessionToken: session.token });

    expect(received).toHaveLength(1);
    const [published] = received as [SignedOutEvent];
    expect(published).toBeInstanceOf(SignedOutEvent);
    expect(published.personId).toBe('person-1');
  });
});
