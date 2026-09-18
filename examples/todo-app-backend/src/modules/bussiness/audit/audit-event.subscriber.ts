import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Subscription } from 'rxjs';
import {
  PlatformEventBus,
  PlatformEventHandler,
  SignedInEvent,
  SignedOutEvent,
  TaskCompletedEvent,
  TaskCreatedEvent,
  TaskDeletedEvent,
} from '../../platform/events';
import { AUDIT_SEALED_ACTIONS } from './audit-operator-read';
import { AppendLogLineCommand } from './append-log-line.command';

/**
 * fr.audit.log.append's trigger: "a tracked action completes elsewhere in the product". This is the one
 * subscriber sds.audit.log-chain's `subscribes` names - the only place audit ever learns that login or
 * task did something, through PlatformEventBus, never by importing `bussiness/login`/`bussiness/task`
 * directly. Every branch dispatches AppendLogLineCommand rather than calling AuditLogService itself, so
 * the write goes through the same CQRS seam every GraphQL-triggered write does.
 *
 * The five branches are contract.audit.emitted-events' vocabulary; each looks its action label up in
 * AUDIT_SEALED_ACTIONS so the kinds-to-actions mapping is stated once. The bus's typed vocabulary also
 * carries NewDeviceSigninEvent, which no use case publishes today
 * (src/modules/platform/events/events.types.ts)
 * and which this contract does not name - an event outside the vocabulary falls through the chain
 * ignored, never failed, per the contract's consumerObligations.
 */
@Injectable()
export class AuditEventSubscriber implements OnModuleInit, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    private readonly events: PlatformEventBus,
    private readonly commandBus: CommandBus,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events.subscribe(this.handle);
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private readonly handle: PlatformEventHandler = event => {
    void this.route(event);
  };

  private async route(event: Parameters<PlatformEventHandler>[0]): Promise<void> {
    let actorId: string | null = null;
    let action: string | null = null;
    let target: string | null = null;
    if (event instanceof TaskCreatedEvent) {
      actorId = event.ownerId; action = AUDIT_SEALED_ACTIONS['event.task.created']; target = event.taskId;
    } else if (event instanceof TaskCompletedEvent) {
      actorId = event.ownerId; action = AUDIT_SEALED_ACTIONS['event.task.completed']; target = event.taskId;
    } else if (event instanceof TaskDeletedEvent) {
      actorId = event.ownerId; action = AUDIT_SEALED_ACTIONS['event.task.deleted']; target = event.taskId;
    } else if (event instanceof SignedInEvent) {
      actorId = event.personId; action = AUDIT_SEALED_ACTIONS['event.login.signed-in'];
    } else if (event instanceof SignedOutEvent) {
      actorId = event.personId; action = AUDIT_SEALED_ACTIONS['event.login.signed-out'];
    }
    if (!actorId || !action) return;
    await this.commandBus.execute(new AppendLogLineCommand({ actorId, action, target }));
  }
}
