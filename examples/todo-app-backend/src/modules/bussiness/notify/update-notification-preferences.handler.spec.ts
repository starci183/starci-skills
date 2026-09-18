import { PreferencesService } from './preferences.service';
import { NotifyPreferenceEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { UpdateNotificationPreferencesCommand } from './update-notification-preferences.command';
import { UpdateNotificationPreferencesHandler } from './update-notification-preferences.handler';

describe('UpdateNotificationPreferencesHandler', () => {
  const buildHandler = () => {
    const preferences = new PreferencesService(
      createFakeEntityManager<NotifyPreferenceEntity>(row => `${row.personId}:${row.channel}`) as never,
    );
    return { preferences, handler: new UpdateNotificationPreferencesHandler(preferences) };
  };

  it('sets the digest window without touching unsubscribed', async () => {
    const { handler } = buildHandler();
    const result = await handler.execute(
      new UpdateNotificationPreferencesCommand({ actorId: 'owner-1', channel: 'email', digestWindowMinutes: 15 }),
    );
    expect(result).toEqual({ channel: 'email', unsubscribed: false, digestWindowMinutes: 15 });
  });

  it('a later call that only sets unsubscribed keeps the earlier digestWindowMinutes', async () => {
    const { handler } = buildHandler();
    await handler.execute(new UpdateNotificationPreferencesCommand({ actorId: 'owner-1', channel: 'email', digestWindowMinutes: 15 }));
    const result = await handler.execute(new UpdateNotificationPreferencesCommand({ actorId: 'owner-1', channel: 'email', unsubscribed: true }));
    expect(result).toEqual({ channel: 'email', unsubscribed: true, digestWindowMinutes: 15 });
  });
});
