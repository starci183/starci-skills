import {
    Injectable, OnModuleDestroy, OnModuleInit 
} from "@nestjs/common"
import type {
    Subscription 
} from "rxjs"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    SignedInEvent, TaskCompletedEvent 
} from "@modules/platform/events/events.types"
import {
    NotifyService 
} from "./notify.service"

const EMAIL_CHANNEL = "email"

/**
 * Wires notify's two PlatformEventBus subscriptions. `TaskCompletedEvent` is a real, honest trigger for
 * fr.notify.on-completion: complete-task's use case publishes it with a stable `sourceEventId`
 * (contract.notify.task-completion-feed), so admitting it here never invents an id the producer did not
 * supply.
 *
 * `SignedInEvent` is also subscribed here, but deliberately produces no notification. fr.notify.on-new-device
 * needs a *new device* signal; `SignedInEvent` fires on every sign-in, carries no `deviceId`, and does
 * not distinguish a known device from a new one. Synthesizing a "new-device" kind from it would violate
 * contract.notify.new-device-signal's consumer obligation ("notify never infers a device identity from
 * anything other than what this surface supplies") and would contradict gap.notify.new-device-event's own
 * statement that no such field exists yet. This handler exists so the seam is genuinely wired and
 * genuinely tested (see the spec beside this file), and stays a deliberate no-op until
 * gap.login.device-field closes and a real new-device signal exists to subscribe to instead.
 */
@Injectable()
/** Subscriber wiring the notify capability's platform-event subscriptions; the spec beside it proves the wiring, not the timing. */
export class NotifyEventSubscriber implements OnModuleInit, OnModuleDestroy {
    private subscription: Subscription | undefined

    constructor(
    private readonly events: PlatformEventBus,
    private readonly notify: NotifyService,
    ) {}

    onModuleInit(): void {
        this.subscription = this.events.subscribe(event => {
            if (event instanceof TaskCompletedEvent) {
                void this.onTaskCompleted(event)
            } else if (event instanceof SignedInEvent) {
                this.onSignedIn()
            }
        })
    }

    onModuleDestroy(): void {
        this.subscription?.unsubscribe()
        this.subscription = undefined
    }

    private async onTaskCompleted(event: TaskCompletedEvent): Promise<void> {
        await this.notify.admit({
            kind: "task-complete",
            sourceEventId: event.sourceEventId,
            recipientId: event.ownerId,
            channel: EMAIL_CHANNEL,
            payload: {
                taskId: event.taskId, completedAt: event.completedAt.toISOString() 
            },
        })
    }

    /** See the class comment: intentionally a no-op, kept as a named method (rather than an empty branch)
   * so gap.notify.new-device-event has one call site to point at once it closes. */
    private onSignedIn(): void {
    // No honest new-device notification can be built from a plain sign-in event; see the class comment.
    }
}
