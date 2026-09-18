import { PreferencesService } from './preferences.service';
import { NotifyPreferenceEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { UnsubscribeCommand } from './unsubscribe.command';
import { UnsubscribeHandler } from './unsubscribe.handler';

describe('UnsubscribeHandler', () => {
  it('ac.notify.unsubscribe.honored.suppresses-future-sends: sets unsubscribed for the actor and channel', async () => {
    const preferences = new PreferencesService(
      createFakeEntityManager<NotifyPreferenceEntity>(row => `${row.personId}:${row.channel}`) as never,
    );
    const handler = new UnsubscribeHandler(preferences);

    const result = await handler.execute(new UnsubscribeCommand({ actorId: 'owner-1', channel: 'email' }));

    expect(result).toEqual({ channel: 'email', unsubscribed: true });
    expect(await preferences.isUnsubscribed('owner-1', 'email')).toBe(true);
    expect(await preferences.isUnsubscribed('owner-2', 'email')).toBe(false);
  });
});
