import { SessionRepository } from './session.repository';

describe('SessionRepository', () => {
  it('sds.login.session-store: expiry is enforced on read, and the row is deleted on the way out', () => {
    const repository = new SessionRepository();
    const session = repository.tAccept('person-1');
    jest.spyOn(Date, 'now').mockReturnValue(session.expiresAt.getTime() + 1);

    expect(() => repository.findActive(session.token)).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
    expect(() => repository.findActive(session.token)).toThrow(expect.objectContaining({ code: 'SESSION_NOT_FOUND' }));

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('ac.login.session.restores.returning-within-the-window-stays-signed-in: a session within the window is still active', () => {
    const repository = new SessionRepository();
    const session = repository.tAccept('person-1');

    const active = repository.findActive(session.token);

    expect(active.personId).toBe('person-1');
  });

  it('t-revoke: the row is deleted so the next read of that token finds nothing', () => {
    const repository = new SessionRepository();
    const session = repository.tAccept('person-1');

    repository.tRevoke(session.token);

    expect(() => repository.findActive(session.token)).toThrow(expect.objectContaining({ code: 'SESSION_NOT_FOUND' }));
  });
});
