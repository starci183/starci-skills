import { AppConfigService } from '../../platform/config';
import { SessionEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { SessionService } from './session.service';

describe('SessionService', () => {
  const buildService = () =>
    new SessionService(createFakeEntityManager<SessionEntity>('token') as never, new AppConfigService());

  it('t-begin: a malformed email is refused before any write, and a well-formed one passes through', () => {
    const service = buildService();
    expect(() => service.tBegin('not-an-email')).toThrow(expect.objectContaining({ code: 'INVALID_CREDENTIALS' }));
    expect(() => service.tBegin('person@example.com')).not.toThrow();
  });

  it('sds.login.session-store: expiry is enforced on read, and the row is deleted on the way out', async () => {
    const service = buildService();
    const session = await service.tAccept('person-1');
    jest.spyOn(Date, 'now').mockReturnValue(session.expiresAt.getTime() + 1);

    await expect(service.findActive(session.token)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await expect(service.findActive(session.token)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('ac.login.session.restores.returning-within-the-window-stays-signed-in: a session within the window is still active', async () => {
    const service = buildService();
    const session = await service.tAccept('person-1');

    const active = await service.findActive(session.token);

    expect(active.personId).toBe('person-1');
  });

  it('t-revoke: the row is deleted so the next read of that token finds nothing', async () => {
    const service = buildService();
    const session = await service.tAccept('person-1');

    await service.tRevoke(session.token);

    await expect(service.findActive(session.token)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('sds.login.session-store t-accept: a successful sign-in writes one session row with a thirty-day expiry', async () => {
    const service = buildService();
    const session = await service.tAccept('person-1');
    const days = Math.round((session.expiresAt.getTime() - session.issuedAt.getTime()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(30);
  });

  it('an operation without a session token is refused before any database read', async () => {
    const entityManager = createFakeEntityManager<SessionEntity>('token');
    const findOneBySpy = jest.spyOn(entityManager, 'findOneBy');
    const service = new SessionService(entityManager as never, new AppConfigService());
    await service.tAccept('person-1'); // a real session exists, so a bypass would have something to match.

    await expect(service.findActive('')).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    await expect(service.findActive(undefined as unknown as string)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });

    expect(findOneBySpy).not.toHaveBeenCalled();
  });
});
