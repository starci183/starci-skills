import { PreferencesService } from './preferences.service';
import { NotifyPreferenceEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    service = new PreferencesService(
      createFakeEntityManager<NotifyPreferenceEntity>(row => `${row.personId}:${row.channel}`) as never,
    );
  });

  it('data.notify.preference: no row reads as the default (not unsubscribed, no override)', async () => {
    const pref = await service.get('person-1', 'email');
    expect(pref.unsubscribed).toBe(false);
    expect(pref.digestWindowMinutes).toBeNull();
  });

  it('ac.notify.unsubscribe.honored.suppresses-future-sends: unsubscribing is per person and per channel', async () => {
    await service.setUnsubscribed('person-1', 'email', true);

    expect(await service.isUnsubscribed('person-1', 'email')).toBe(true);
    expect(await service.isUnsubscribed('person-1', 'sms')).toBe(false);
    expect(await service.isUnsubscribed('person-2', 'email')).toBe(false);
  });

  it('re-subscribing (unsubscribed: false) reverses the suppression', async () => {
    await service.setUnsubscribed('person-1', 'email', true);
    await service.setUnsubscribed('person-1', 'email', false);

    expect(await service.isUnsubscribed('person-1', 'email')).toBe(false);
  });

  it('data.notify.preference invariant: at most one row per (personId, channel) - setting unsubscribed preserves an existing digestWindowMinutes', async () => {
    await service.setDigestWindowMinutes('person-1', 'email', 15);
    await service.setUnsubscribed('person-1', 'email', true);

    const pref = await service.get('person-1', 'email');
    expect(pref.unsubscribed).toBe(true);
    expect(pref.digestWindowMinutes).toBe(15);
  });
});
