import { AppConfigService } from '../../platform/config';
import { SessionRow, SessionRowStore } from './session-row-store';
import { SessionRepository } from './session.repository';

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

describe('SessionRepository', () => {
  const buildRepository = () => new SessionRepository(new FakeSessionStore(), new AppConfigService());

  it('sds.login.session-store: expiry is enforced on read, and the row is deleted on the way out', async () => {
    const repository = buildRepository();
    const session = await repository.tAccept('person-1');
    jest.spyOn(Date, 'now').mockReturnValue(session.expiresAt.getTime() + 1);

    await expect(repository.findActive(session.token)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await expect(repository.findActive(session.token)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('ac.login.session.restores.returning-within-the-window-stays-signed-in: a session within the window is still active', async () => {
    const repository = buildRepository();
    const session = await repository.tAccept('person-1');

    const active = await repository.findActive(session.token);

    expect(active.personId).toBe('person-1');
  });

  it('t-revoke: the row is deleted so the next read of that token finds nothing', async () => {
    const repository = buildRepository();
    const session = await repository.tAccept('person-1');

    await repository.tRevoke(session.token);

    await expect(repository.findActive(session.token)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('sds.login.session-store t-accept: a successful sign-in writes one session row with a thirty-day expiry', async () => {
    const repository = buildRepository();
    const session = await repository.tAccept('person-1');
    const days = Math.round((session.expiresAt.getTime() - session.issuedAt.getTime()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(30);
  });
});
