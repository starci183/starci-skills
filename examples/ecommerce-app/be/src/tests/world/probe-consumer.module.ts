import { Injectable, Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { OrderError, OrderErrorCode } from "@modules/domain/order"
import { ProbePingEvent } from "../fixtures/events/probe-ping.event"

@Injectable()
/** What the probe consumer does with a delivery, set by the spec that drives it. */
export class ProbeBehavior {
    /** True while every delivery fails. */
    failing = false
    /** The attempts the consumer saw, in arrival order. */
    readonly attempts: Array<number> = []
    /** The notes of the deliveries whose effect ran (the first claim of their event id). */
    readonly effects: Array<string> = []
}

@Injectable()
/** The consumer of `probe.ping` of the bus specs: it claims the event id in the inbox first, then records the effect, or fails while the spec says so. */
export class ProbePingConsumer implements EventConsumer<ProbePingEvent> {
    readonly event = ProbePingEvent

    constructor(
        private readonly behavior: ProbeBehavior,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

    /** Records the attempt; a failing probe throws, otherwise the first claim of the event id records the effect. */
    async handle(delivery: EventDelivery<ProbePingEvent>): Promise<void> {
        this.behavior.attempts.push(delivery.attempt)
        if (this.behavior.failing) throw new OrderError({ code: OrderErrorCode.PlacementFailed })
        if (await this.inbox.claim("probe", delivery.eventId)) this.behavior.effects.push(delivery.event.payload.note)
    }
}

@Module({ providers: [ProbeBehavior, ProbePingConsumer], exports: [ProbeBehavior] })
/** Registers the probe consumer with the bus, the way a feature message module does. */
export class ProbeConsumerModule implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly consumer: ProbePingConsumer,
    ) {}

    /** Hands the probe consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.consumer)
    }
}
