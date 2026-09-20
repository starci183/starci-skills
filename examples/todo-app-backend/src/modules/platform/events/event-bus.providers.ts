import {
    Injectable 
} from "@nestjs/common"
import {
    Subject, Subscription 
} from "rxjs"
import {
    NewDeviceSigninEvent,
    SignedInEvent,
    SignedOutEvent,
    TaskCompletedEvent,
    TaskCreatedEvent,
    TaskDeletedEvent,
} from "./events.types"

/**
 * Not exported (see events.types.ts's comment above the equivalent union it used to declare): a class
 * union has no statically provable object shape for the backend naming check, so this stays a same-file
 * type used only by this bus's own method signatures below.
 */
type PlatformEvent =
  | TaskCreatedEvent
  | TaskCompletedEvent
  | TaskDeletedEvent
  | SignedInEvent
  | SignedOutEvent
  | NewDeviceSigninEvent;

/** A named contract for a subscriber, instead of an inline function type at the call site. */
export type PlatformEventHandler = (event: PlatformEvent) => void;

/**
 * A small typed in-process event bus, chosen over @nestjs/event-emitter: this example has no existing
 * event-emitter dependency, and adding one would need a fresh `npm install` this host cannot reliably
 * reach. RxJS is already a transitive dependency of @nestjs/common, so it is enough to give every feature
 * a synchronous, typed publish/subscribe port without adding a new package. `Subject` is deliberately not
 * a `ReplaySubject`: a consumer that registers after an event fired does not retroactively see it, which
 * matches the at-least-once/per-key delivery every declared work/event@1 record already commits to only
 * within a live process, not as a durable log.
 *
 * This is the port every consumer subscribes through, and the only way any feature may learn that
 * task/login did something, so no feature ever imports another feature's module directly for that
 * purpose.
 */
@Injectable()
/** Class for the platform event bus concern the platform/events capability owns; the file header names the business rule it implements. */
export class PlatformEventBus {
    private readonly subject = new Subject<PlatformEvent>()

    publish(event: PlatformEvent): void {
        this.subject.next(event)
    }

    subscribe(handler: PlatformEventHandler): Subscription {
        return this.subject.subscribe(handler)
    }
}
