import { PreferencesService } from './preferences.service';
import { NotifyPreferenceEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { NotificationPreferencesQuery } from './notification-preferences.query';
import { NotificationPreferencesHandler } from './notification-preferences.handler';

describe('NotificationPreferencesHandler', () => {
  it('data.notify.preference: reads back the default when no preference has ever been written', async () => {
    const preferences = new PreferencesService(
      createFakeEntityManager<NotifyPreferenceEntity>(row => `${row.personId}:${row.channel}`) as never,
    );
    const handler = new NotificationPreferencesHandler(preferences);

    const result = await handler.execute(new NotificationPreferencesQuery({ actorId: 'owner-1', channel: 'email' }));

    expect(result).toEqual({ channel: 'email', unsubscribed: false, digestWindowMinutes: null });
  });

  it('reads back a written preference', async () => {
    const preferences = new PreferencesService(
      createFakeEntityManager<NotifyPreferenceEntity>(row => `${row.personId}:${row.channel}`) as never,
    );
    await preferences.update('owner-1', 'email', { unsubscribed: true, digestWindowMinutes: 5 });
    const handler = new NotificationPreferencesHandler(preferences);

    const result = await handler.execute(new NotificationPreferencesQuery({ actorId: 'owner-1', channel: 'email' }));

    expect(result).toEqual({ channel: 'email', unsubscribed: true, digestWindowMinutes: 5 });
  });
});
