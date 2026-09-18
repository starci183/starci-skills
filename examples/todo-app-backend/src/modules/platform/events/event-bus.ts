import { Injectable } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { PlatformEvent } from './events.types';

/** A named contract for a subscriber, instead of an inline function type at the call site. */
export interface PlatformEventHandler {
  (event: PlatformEvent): void;
}

/**
 * A small typed in-process event bus, chosen over @nestjs/event-emitter: this example has no existing
 * event-emitter dependency, and adding one would need a fresh `npm install` this host cannot reliably
 * reach. RxJS is already a transitive dependency of @nestjs/common, so it is enough to give every feature
 * a synchronous, typed publish/subscribe port without adding a new package. `Subject` is deliberately not
 * a `ReplaySubject`: a consumer that registers after an event fired does not retroactively see it, which
 * matches the at-least-once/per-key delivery every declared work/event record already commits to only
 * within a live process, not as a durable log.
 *
 * This is the port every consumer subscribes through, and the only way any feature may learn that
 * task/login did something, so no feature ever imports another feature's module directly for that
 * purpose.
 */
@Injectable()
export class PlatformEventBus {
  private readonly subject = new Subject<PlatformEvent>();

  publish(event: PlatformEvent): void {
    this.subject.next(event);
  }

  subscribe(handler: PlatformEventHandler): Subscription {
    return this.subject.subscribe(handler);
  }
}
