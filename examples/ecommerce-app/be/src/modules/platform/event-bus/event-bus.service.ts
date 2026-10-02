import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { isRecord } from "@modules/platform/primitives"
import { EventBusError, EventBusErrorCode } from "./errors/event-bus.error"
import type { BaseEvent, EventClass, EventDeadLetter, EventEnvelope } from "./event-bus.contracts"
import { InjectEventBusOptions, InjectEventTransport } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"
import type { EventBus } from "./event-bus.port"
import type { EventTransport, InboundMessage } from "./event-transport.port"
import {
    ATTEMPT_HEADER,
    DEAD_LETTER_ID_SEPARATOR,
    ORIGIN_HEADER,
    REASON_HEADER,
    REQUEUED_HEADER,
    deadLetterTopicOf,
    retryTopicOf,
    topicOf,
} from "./event.policy"
import { INSERT_OUTBOX_ROW } from "./persistence/event-bus.sql"

/** The body of a marker message: it carries nothing, its header says which dead letter it closes. */
const MARKER_VALUE = "{}"

/** The id of a dead letter: where its message sits on the dead-letter topic. */
const deadLetterIdOf = (message: InboundMessage): string =>
    [message.topic, message.partition, message.offset].join(DEAD_LETTER_ID_SEPARATOR)

/** The event name an envelope text carries, or an empty text when the text is not an envelope. */
const eventNameOf = (value: string): string => {
    try {
        const envelope: unknown = JSON.parse(value)
        return isRecord(envelope) && typeof envelope.eventName === "string" ? envelope.eventName : ""
    } catch {
        return ""
    }
}

@Injectable()
/**
 * The publishing side of the event bus. `publish` writes the event as a row of the outbox of the caller's transaction, so the
 * event exists exactly when the change it reports commits; the relay hands the row to the broker afterwards. The operator
 * reads follow the broker: the retry topic says what waits for its backoff, the dead-letter topic what ran out of attempts,
 * and a requeue puts the original message back on its main topic and closes the dead letter with a marker.
 */
export class EventBusService implements EventBus {
    constructor(
        @InjectEventBusOptions() private readonly options: EventBusOptions,
        @InjectEventTransport() private readonly transport: EventTransport,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Writes the event in the outbox of the transaction `tx`; the event id is the partition key, so the events of one aggregate keep their order. */
    async publish(event: BaseEvent, tx: EntityManager): Promise<void> {
        const envelope: EventEnvelope = { eventId: event.eventId, eventName: event.eventName, payload: event.payload }
        await tx.query(INSERT_OUTBOX_ROW, [
            event.eventId,
            event.eventName,
            topicOf(this.options.topicPrefix, event.eventName),
            event.eventId,
            JSON.stringify(envelope),
            this.clock.now(),
        ])
    }

    /** How many deliveries of the class wait on the retry topic for their backoff to pass. */
    pendingRetries(event: EventClass<BaseEvent>): Promise<number> {
        return this.transport.lag(retryTopicOf(this.options.topicPrefix, event.eventName))
    }

    /** The events of the class that ran out of attempts and were not requeued since. */
    async deadLetters(event: EventClass<BaseEvent>): Promise<ReadonlyArray<EventDeadLetter>> {
        const messages = await this.transport.read(deadLetterTopicOf(this.options.topicPrefix, event.eventName))
        const closed = new Set(messages.flatMap((message) => message.headers[REQUEUED_HEADER] ?? []))
        return messages
            .filter((message) => message.headers[REQUEUED_HEADER] === undefined)
            .filter((message) => eventNameOf(message.value) === event.eventName)
            .filter((message) => !closed.has(deadLetterIdOf(message)))
            .map((message) => ({
                id: deadLetterIdOf(message),
                eventName: event.eventName,
                eventId: message.key,
                reason: message.headers[REASON_HEADER] ?? "",
                attempts: Number(message.headers[ATTEMPT_HEADER] ?? 0),
            }))
    }

    /** Puts a dead letter back on its main topic with a fresh attempt count and closes it with a marker; an id the topic does not hold is refused. */
    async requeue(deadLetterId: string): Promise<void> {
        const topic = deadLetterId.split(DEAD_LETTER_ID_SEPARATOR)[0] ?? ""
        const letter = (await this.transport.read(topic)).find((message) => deadLetterIdOf(message) === deadLetterId)
        const origin = letter?.headers[ORIGIN_HEADER]
        if (letter === undefined || origin === undefined) {
            throw new EventBusError({ code: EventBusErrorCode.DeadLetterUnknown, params: { id: deadLetterId } })
        }
        await this.transport.send([
            { topic: origin, key: letter.key, value: letter.value, headers: {} },
            { topic, key: letter.key, value: MARKER_VALUE, headers: { [REQUEUED_HEADER]: deadLetterId } },
        ])
    }
}
