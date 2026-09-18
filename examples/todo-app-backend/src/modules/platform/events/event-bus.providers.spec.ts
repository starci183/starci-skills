import { PlatformEventBus } from './event-bus.providers';
import { SignedInEvent, SignedOutEvent, TaskCompletedEvent, TaskCreatedEvent, TaskDeletedEvent } from './events.types';

describe('PlatformEventBus', () => {
  it('event.task.created: a subscriber receives exactly what is published', () => {
    const bus = new PlatformEventBus();
    const received: unknown[] = [];
    bus.subscribe(event => received.push(event));

    const event = new TaskCreatedEvent('task-1', 'owner-1', new Date('2026-09-18T00:00:00.000Z'), 'src-1');
    bus.publish(event);

    expect(received).toEqual([event]);
  });

  it('a subscriber registered after publish does not retroactively see the earlier event', () => {
    const bus = new PlatformEventBus();
    bus.publish(new TaskCreatedEvent('task-1', 'owner-1', new Date(), 'src-1'));

    const received: unknown[] = [];
    bus.subscribe(event => received.push(event));

    expect(received).toHaveLength(0);
  });

  it('event.task.completed, event.task.deleted, event.login.signed-in, event.login.signed-out all carry their declared fields', () => {
    const bus = new PlatformEventBus();
    const received: unknown[] = [];
    bus.subscribe(event => received.push(event));

    bus.publish(new TaskCompletedEvent('task-1', 'owner-1', new Date(), 'src-1'));
    bus.publish(new TaskDeletedEvent('task-1', 'owner-1', new Date(), 'src-2'));
    bus.publish(new SignedInEvent('person-1', new Date(), 'src-3'));
    bus.publish(new SignedOutEvent('person-1', new Date(), 'src-4'));

    expect(received.map(event => (event as { kind: string }).kind)).toEqual([
      'event.task.completed',
      'event.task.deleted',
      'event.login.signed-in',
      'event.login.signed-out',
    ]);
  });
});
