import { Injectable, OnModuleInit } from '@nestjs/common';
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
import { AppendLogLineCommand } from './append-log-line.command';

/**
 * fr.audit.log.append's trigger: "a tracked action completes elsewhere in the product". This is the one
 * subscriber sds.audit.log-chain's `subscribes` names - the only place audit ever learns that login or
 * task did something, through PlatformEventBus, never by importing `bussiness/login`/`bussiness/task`
 * directly. Every branch dispatches AppendLogLineCommand rather than calling AuditLogService itself, so
 * the write goes through the same CQRS seam every GraphQL-triggered write does.
 */
@Injectable()
export class AuditEventSubscriber implements OnModuleInit {
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
    if (event instanceof TaskCreatedEvent) {
      await this.append(event.ownerId, 'task.created', event.taskId);
    } else if (event instanceof TaskCompletedEvent) {
      await this.append(event.ownerId, 'task.completed', event.taskId);
    } else if (event instanceof TaskDeletedEvent) {
      await this.append(event.ownerId, 'task.deleted', event.taskId);
    } else if (event instanceof SignedInEvent) {
      await this.append(event.personId, 'login.signed-in', null);
    } else if (event instanceof SignedOutEvent) {
      await this.append(event.personId, 'login.signed-out', null);
    }
  }

  private async append(actorId: string, action: string, target: string | null): Promise<void> {
    await this.commandBus.execute(new AppendLogLineCommand({ actorId, action, target }));
  }
}
