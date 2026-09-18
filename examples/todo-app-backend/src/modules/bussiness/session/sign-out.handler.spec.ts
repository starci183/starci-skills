import { Repository } from 'typeorm';
import { SessionService } from './session.service';
import { SessionEntity } from '../../platform/databases/postgresql/primary';
import { KeycloakClient } from '../../integrations/keycloak';
import { AppConfigService } from '../../platform/config';
import { PlatformEventBus, SignedOutEvent } from '../../platform/events';
import { SignOutCommand } from './sign-out.command';
import { SignOutHandler } from './sign-out.handler';

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

describe('SignOutHandler', () => {
  it('br.login.session.restores: the session ends and the next request against that token is unauthenticated', async () => {
    const sessionService = new SessionService(
      new FakeSessionRepository() as unknown as Repository<SessionEntity>,
      new AppConfigService(),
    );
    const session = await sessionService.tAccept('person-1');
    const keycloakClient = new KeycloakClient(new AppConfigService());
    jest.spyOn(keycloakClient, 'notifySignOut').mockResolvedValue(undefined);

    const handler = new SignOutHandler(sessionService, keycloakClient, new PlatformEventBus());
    const result = await handler.execute(new SignOutCommand({ sessionToken: session.token }));

    expect(result.signedOut).toBe(true);
    await expect(sessionService.findActive(session.token)).rejects.toThrow();
  });

  it('event.login.signed-out: publishes on the PlatformEventBus after the session is revoked', async () => {
    const sessionService = new SessionService(
      new FakeSessionRepository() as unknown as Repository<SessionEntity>,
      new AppConfigService(),
    );
    const session = await sessionService.tAccept('person-1');
    const keycloakClient = new KeycloakClient(new AppConfigService());
    jest.spyOn(keycloakClient, 'notifySignOut').mockResolvedValue(undefined);
    const events = new PlatformEventBus();
    const received: unknown[] = [];
    events.subscribe(event => received.push(event));

    const handler = new SignOutHandler(sessionService, keycloakClient, events);
    await handler.execute(new SignOutCommand({ sessionToken: session.token }));

    expect(received).toHaveLength(1);
    const [published] = received as [SignedOutEvent];
    expect(published).toBeInstanceOf(SignedOutEvent);
    expect(published.personId).toBe('person-1');
  });
});
