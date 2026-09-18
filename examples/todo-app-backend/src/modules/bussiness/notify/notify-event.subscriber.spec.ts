import { NotifyEventSubscriber } from './notify-event.subscriber';
import { NotifyService } from './notify.service';
import { PlatformEventBus, SignedInEvent, TaskCompletedEvent } from '../../platform/events';

describe('NotifyEventSubscriber', () => {
  it('event.task.completed: admits a task-complete notification with the producer-supplied sourceEventId, never an invented one', async () => {
    const events = new PlatformEventBus();
    const admit = jest.fn().mockResolvedValue(undefined);
    const notify = { admit } as unknown as NotifyService;
    const subscriber = new NotifyEventSubscriber(events, notify);
    subscriber.onModuleInit();

    events.publish(new TaskCompletedEvent('task-1', 'owner-1', new Date('2026-09-18T06:00:00.000Z'), 'evt-1'));
    await flush();

    expect(admit).toHaveBeenCalledWith({
      kind: 'task-complete',
      sourceEventId: 'evt-1',
      recipientId: 'owner-1',
      channel: 'email',
      payload: { taskId: 'task-1', completedAt: '2026-09-18T06:00:00.000Z' },
    });
  });

  it('event.login.signed-in: gap.notify.new-device-event - subscribing does not fabricate a new-device notification', async () => {
    const events = new PlatformEventBus();
    const admit = jest.fn().mockResolvedValue(undefined);
    const notify = { admit } as unknown as NotifyService;
    const subscriber = new NotifyEventSubscriber(events, notify);
    subscriber.onModuleInit();

    events.publish(new SignedInEvent('person-1', new Date('2026-09-18T06:00:00.000Z'), 'evt-2'));
    await flush();

    expect(admit).not.toHaveBeenCalled();
  });

  it('unsubscribes on destroy: a later publish reaches nothing', async () => {
    const events = new PlatformEventBus();
    const admit = jest.fn().mockResolvedValue(undefined);
    const notify = { admit } as unknown as NotifyService;
    const subscriber = new NotifyEventSubscriber(events, notify);
    subscriber.onModuleInit();
    subscriber.onModuleDestroy();

    events.publish(new TaskCompletedEvent('task-1', 'owner-1', new Date(), 'evt-3'));
    await flush();

    expect(admit).not.toHaveBeenCalled();
  });
});

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}
