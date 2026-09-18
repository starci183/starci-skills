import { NotifyService } from './notify.service';
import { DedupeService } from './dedupe.service';
import { DigestService } from './digest.service';
import { PreferencesService } from './preferences.service';
import { DeliveryService } from './delivery.service';
import {
  NotifyDeliveryAttemptEntity,
  NotifyDigestWindowEntity,
  NotifyNotificationEntity,
  NotifyPreferenceEntity,
} from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { FakeNotifySmtpClient } from '../../integrations/notify-smtp/testing/fake-notify-smtp.client';
import { FakeNotifyQueueClient } from '../../integrations/notify-queue/testing/fake-notify-queue.client';

function buildNotify() {
  const dedupe = new DedupeService(createFakeEntityManager<NotifyNotificationEntity>('id') as never);
  const digest = new DigestService(createFakeEntityManager<NotifyDigestWindowEntity>('id') as never);
  const preferences = new PreferencesService(
    createFakeEntityManager<NotifyPreferenceEntity>(row => `${row.personId}:${row.channel}`) as never,
  );
  const smtp = new FakeNotifySmtpClient();
  const delivery = new DeliveryService(createFakeEntityManager<NotifyDeliveryAttemptEntity>('notificationId') as never, smtp);
  const queue = new FakeNotifyQueueClient();
  const notify = new NotifyService(dedupe, digest, preferences, delivery, queue);
  return { notify, dedupe, digest, preferences, delivery, smtp, queue };
}

describe('NotifyService', () => {
  it('fr.notify.on-completion: admitting a task-complete event queues a delivery inside the digest window', async () => {
    const { notify, delivery } = buildNotify();
    const t0 = new Date('2026-09-18T06:00:00.000Z');

    const result = await notify.admit(
      { kind: 'task-complete', sourceEventId: 'evt-1', recipientId: 'owner-1', channel: 'email', payload: { taskId: 'task-1' } },
      t0,
    );

    expect(result.isNew).toBe(true);
    expect(result.deliveryState).toBe('queued');
    const attempt = await delivery.findById(result.notificationId);
    expect(attempt?.state).toBe('queued');
  });

  it('br.notify.delivery.once: admitting the same (kind, sourceEventId, recipientId) twice never creates a second delivery attempt', async () => {
    const { notify } = buildNotify();
    const t0 = new Date('2026-09-18T06:00:00.000Z');
    const input = { kind: 'task-complete', sourceEventId: 'evt-1', recipientId: 'owner-1', channel: 'email', payload: {} };

    const first = await notify.admit(input, t0);
    const second = await notify.admit(input, new Date(t0.getTime() + 1_000));

    expect(second.isNew).toBe(false);
    expect(second.notificationId).toBe(first.notificationId);
  });

  it('fr.notify.digest / ac.notify.digest.window.collapses-into-one-message: two events for the same person and channel become one message when the window closes', async () => {
    const { notify, smtp } = buildNotify();
    const t0 = new Date('2026-09-18T06:00:00.000Z');
    const t1 = new Date('2026-09-18T06:05:00.000Z');

    await notify.admit({ kind: 'task-complete', sourceEventId: 'evt-1', recipientId: 'owner-1', channel: 'email', payload: { taskId: 'task-1' } }, t0);
    await notify.admit({ kind: 'task-complete', sourceEventId: 'evt-2', recipientId: 'owner-1', channel: 'email', payload: { taskId: 'task-2' } }, t1);

    // Before the (default 10-minute) window closes, nothing goes out.
    await notify.runDueJobs(new Date('2026-09-18T06:09:00.000Z'));
    expect(smtp.sent).toHaveLength(0);

    // At close, both events are read together as one message.
    await notify.runDueJobs(new Date('2026-09-18T06:10:00.000Z'));
    expect(smtp.sent).toHaveLength(1);
    expect(smtp.sent[0].body).toContain('task-1');
    expect(smtp.sent[0].body).toContain('task-2');
  });

  it('fr.notify.unsubscribe / ac.notify.unsubscribe.honored.suppresses-future-sends: an unsubscribed recipient never joins a window and never receives a message', async () => {
    const { notify, preferences, smtp } = buildNotify();
    await preferences.setUnsubscribed('owner-1', 'email', true);

    const result = await notify.admit(
      { kind: 'task-complete', sourceEventId: 'evt-1', recipientId: 'owner-1', channel: 'email', payload: { taskId: 'task-1' } },
      new Date('2026-09-18T06:00:00.000Z'),
    );

    expect(result.deliveryState).toBe('suppressed');
    await notify.runDueJobs(new Date('2026-09-18T06:20:00.000Z'));
    expect(smtp.sent).toHaveLength(0);
  });

  it('re-subscribing lets a later event reach the digest window again', async () => {
    const { notify, preferences, smtp } = buildNotify();
    await preferences.setUnsubscribed('owner-1', 'email', true);
    await notify.admit(
      { kind: 'task-complete', sourceEventId: 'evt-1', recipientId: 'owner-1', channel: 'email', payload: {} },
      new Date('2026-09-18T06:00:00.000Z'),
    );
    await preferences.setUnsubscribed('owner-1', 'email', false);

    const second = await notify.admit(
      { kind: 'task-complete', sourceEventId: 'evt-2', recipientId: 'owner-1', channel: 'email', payload: { taskId: 'task-2' } },
      new Date('2026-09-18T06:01:00.000Z'),
    );
    expect(second.deliveryState).toBe('queued');

    await notify.runDueJobs(new Date('2026-09-18T06:20:00.000Z'));
    expect(smtp.sent).toHaveLength(1);
    expect(smtp.sent[0].body).toContain('task-2');
  });

  it('nfr.notify.delivery.guarantee: a transient failure retries and eventually delivers exactly once', async () => {
    const { notify, smtp, delivery } = buildNotify();
    smtp.failTransientFor('owner-1');
    const t0 = new Date('2026-09-18T06:00:00.000Z');

    const admitted = await notify.admit(
      { kind: 'task-complete', sourceEventId: 'evt-1', recipientId: 'owner-1', channel: 'email', payload: { taskId: 'task-1' } },
      t0,
    );

    await notify.runDueJobs(new Date('2026-09-18T06:10:00.000Z')); // window closes: first dispatch, fails transiently
    let attempt = await delivery.findById(admitted.notificationId);
    expect(attempt?.state).toBe('queued');
    expect(attempt?.failureClass).toBe('transient');
    expect(smtp.sent).toHaveLength(0);

    // Before the retry backoff elapses, nothing new is due.
    await notify.runDueJobs(new Date('2026-09-18T06:10:15.000Z'));
    expect(smtp.sent).toHaveLength(0);

    smtp.clearFailuresFor('owner-1');
    await notify.runDueJobs(new Date('2026-09-18T06:10:31.000Z')); // 30s backoff elapsed: retry succeeds
    attempt = await delivery.findById(admitted.notificationId);
    expect(attempt?.state).toBe('delivered');
    expect(smtp.sent).toHaveLength(1);
  });
});
