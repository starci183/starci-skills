import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { repeatInOrder } from "@modules/platform/primitives"
import type { BaseEvent } from "./event-bus.contracts"
import { InjectEventBusOptions, InjectEventTransport } from "./event-bus.decorators"
import { EventBusLogEvent } from "./event-bus.log-events"
import type { EventBusOptions } from "./event-bus.options"
import type { EventConsumer, EventConsumerRegistry } from "./event-bus.port"
import { readEnvelopeText } from "./event-envelope.policy"
import type { EventTransport, InboundMessage } from "./event-transport.port"
import {
    ATTEMPTS,
    ATTEMPT_HEADER,
    NOT_BEFORE_HEADER,
    ORIGIN_HEADER,
    REASON_HEADER,
    backoffMs,
    deadLetterTopicOf,
    retryTopicOf,
    topicOf,
} from "./event.policy"

@Injectable()
/**
 * The consumer side of the event bus: the registry the message transport modules fill, and the read loop over the topics of the
 * registered events. A delivery is at least once: the consumer acknowledges by returning; a throw puts the message on the retry
 * topic with a doubling backoff, and after the last attempt on the dead-letter topic, where an operator reads and requeues it.
 * The runner never throws for a failed delivery, so one poisoned event does not stop the partition behind it.
 */
export class EventRunnerService implements EventConsumerRegistry, OnApplicationBootstrap {
    private readonly consumers = new Map<string, ReadonlyArray<EventConsumer<BaseEvent>>>()

    constructor(
        @InjectEventBusOptions() private readonly options: EventBusOptions,
        @InjectEventTransport() private readonly transport: EventTransport,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers a consumer of its event (several features may consume one event); the read loop starts when the app has registered every consumer. */
    add<Event extends BaseEvent>(consumer: EventConsumer<Event>): void {
        const name = consumer.event.eventName
        this.consumers.set(name, [...(this.consumers.get(name) ?? []), consumer])
    }

    /** Starts reading the topics of the registered events and their retry topics. */
    async onApplicationBootstrap(): Promise<void> {
        const names = [...this.consumers.keys()]
        if (names.length === 0) return
        const prefix = this.options.topicPrefix
        const topics = [...new Set(names.flatMap((name) => [topicOf(prefix, name), retryTopicOf(prefix, name)]))]
        await this.transport.subscribe({ topics, onMessage: (message) => this.receive(message) })
    }

    /**
     * Hands one message to every consumer of its event, in the order they registered; the events of the topic nobody here consumes
     * are left alone. A failing consumer does not stop the others; the message goes once to the retry topic when any failed, and
     * each consumer takes a redelivery through its own inbox, so one that already succeeded changes nothing.
     */
    async receive(message: InboundMessage): Promise<void> {
        const { eventName, envelope, cause: unreadable } = readEnvelopeText(message.value)
        const consumers = this.consumers.get(eventName) ?? []
        if (consumers.length === 0) {
            if (unreadable !== null)
                this.logger.error(EventBusLogEvent.MessageSkipped, unreadable, { topic: message.topic })
            else if (eventName === "") this.logger.warn(EventBusLogEvent.MessageSkipped, { topic: message.topic })
            return
        }
        const attempt = Number(message.headers[ATTEMPT_HEADER] ?? 1)
        const notBefore = Number(message.headers[NOT_BEFORE_HEADER] ?? 0)
        const pause = notBefore - this.clock.now().getTime()
        if (pause > 0) await this.transport.wait(pause)
        const failures: Array<unknown> = []
        const buried = await repeatInOrder(async (index) => {
            const consumer = consumers[index]
            if (consumer === undefined) return false
            const event = consumer.event.parse(envelope)
            if (event === null) {
                await this.bury(message, eventName, attempt, "the envelope does not have the shape of the event")
                return true
            }
            try {
                await consumer.handle({ eventId: event.eventId, event, attempt })
            } catch (cause) {
                this.logger.error(EventBusLogEvent.DeliveryFailed, cause, { event: eventName, attempt })
                failures.push(cause)
            }
            return undefined
        })
        if (buried) return
        const [first] = failures
        if (failures.length > 0) {
            await this.failed(message, eventName, attempt, first instanceof Error ? first.message : String(first))
        }
    }

    private async failed(message: InboundMessage, eventName: string, attempt: number, reason: string): Promise<void> {
        if (attempt >= ATTEMPTS) {
            await this.bury(message, eventName, attempt, reason)
            return
        }
        const notBefore = this.clock.now().getTime() + backoffMs(attempt)
        await this.transport.send([
            {
                topic: retryTopicOf(this.options.topicPrefix, eventName),
                key: message.key,
                value: message.value,
                headers: { [ATTEMPT_HEADER]: String(attempt + 1), [NOT_BEFORE_HEADER]: String(notBefore) },
            },
        ])
        this.logger.warn(EventBusLogEvent.DeliveryRetried, { event: eventName, attempt, reason })
    }

    private async bury(message: InboundMessage, eventName: string, attempt: number, reason: string): Promise<void> {
        await this.transport.send([
            {
                topic: deadLetterTopicOf(this.options.topicPrefix, eventName),
                key: message.key,
                value: message.value,
                headers: {
                    [ATTEMPT_HEADER]: String(attempt),
                    [REASON_HEADER]: reason,
                    [ORIGIN_HEADER]: topicOf(this.options.topicPrefix, eventName),
                },
            },
        ])
        this.logger.warn(EventBusLogEvent.DeliveryBuried, { event: eventName, attempts: attempt, reason })
    }
}
