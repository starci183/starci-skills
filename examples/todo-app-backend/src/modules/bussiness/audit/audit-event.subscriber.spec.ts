import { CommandBus } from '@nestjs/cqrs';
import {
  PlatformEventBus,
  SignedInEvent,
  SignedOutEvent,
  TaskCompletedEvent,
  TaskCreatedEvent,
  TaskDeletedEvent,
} from '../../platform/events';
import { AppendLogLineCommand } from './append-log-line.command';
import { AuditEventSubscriber } from './audit-event.subscriber';

/** sds.audit.log-chain's `subscribes`: every event this feature must turn into an appended line. A
 * fake CommandBus records what AuditEventSubscriber dispatches, so this proves the routing without a
 * real Nest DI container or database. */
class RecordingCommandBus {
  readonly dispatched: AppendLogLineCommand[] = [];
  async execute(command: AppendLogLineCommand): Promise<void> {
    this.dispatched.push(command);
  }
}

describe('AuditEventSubscriber', () => {
  const eachEvent: Array<{ event: unknown; action: string; actorField: string; target: string | null }> = [
    { event: new TaskCreatedEvent('task-1', 'owner-1', new Date(), 'src-1'), action: 'task.created', actorField: 'owner-1', target: 'task-1' },
    { event: new TaskCompletedEvent('task-1', 'owner-1', new Date(), 'src-2'), action: 'task.completed', actorField: 'owner-1', target: 'task-1' },
    { event: new TaskDeletedEvent('task-1', 'owner-1', new Date(), 'src-3'), action: 'task.deleted', actorField: 'owner-1', target: 'task-1' },
    { event: new SignedInEvent('person-1', new Date(), 'src-4'), action: 'login.signed-in', actorField: 'person-1', target: null },
    { event: new SignedOutEvent('person-1', new Date(), 'src-5'), action: 'login.signed-out', actorField: 'person-1', target: null },
  ];

  it.each(eachEvent)('fr.audit.log.append: $action is appended for its published event', async ({ event, action, actorField, target }) => {
    const bus = new PlatformEventBus();
    const commandBus = new RecordingCommandBus();
    const subscriber = new AuditEventSubscriber(bus, commandBus as unknown as CommandBus);
    subscriber.onModuleInit();

    bus.publish(event as never);
    await Promise.resolve(); // let the fire-and-forget route() microtask settle

    expect(commandBus.dispatched).toHaveLength(1);
    expect(commandBus.dispatched[0].params).toEqual({ actorId: actorField, action, target });
  });

  it('unsubscribes on module destroy: a later publish dispatches nothing', async () => {
    const bus = new PlatformEventBus();
    const commandBus = new RecordingCommandBus();
    const subscriber = new AuditEventSubscriber(bus, commandBus as unknown as CommandBus);
    subscriber.onModuleInit();
    subscriber.onModuleDestroy();

    bus.publish(new SignedInEvent('person-1', new Date(), 'src-6'));
    await Promise.resolve();

    expect(commandBus.dispatched).toHaveLength(0);
  });
});
