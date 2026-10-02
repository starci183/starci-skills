import { Injectable } from "@nestjs/common"
import type { OnApplicationShutdown } from "@nestjs/common"
import { Kafka, logLevel } from "kafkajs"
import type { Admin, Consumer, IHeaders, Producer } from "kafkajs"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import type { Probe } from "@modules/platform/probes"
import { EventBusError, EventBusErrorCode } from "./errors/event-bus.error"
import { InjectEventBusOptions } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"
import type { EventSubscription, EventTransport, InboundMessage, OutboundMessage } from "./event-transport.port"

/** How long a read of a whole topic may take before it is given up. */
const READ_DEADLINE_MS = 15_000

/** The text of a header value or message field the library hands over as a buffer or text. */
const textOf = (value: Buffer | string | null | undefined): string =>
    value === null || value === undefined ? "" : value.toString()

/** The end offsets of a topic as the broker answers them; a topic it does not know has none and the failure rides along. */
interface TopicEnds {
    /** The partitions with their low and high offsets. */
    readonly ends: ReadonlyArray<{ readonly partition: number; readonly low: string; readonly high: string }>
    /** Why the broker did not answer; null when it did. */
    readonly cause: unknown
}

/** The text headers of a message. */
const headersOf = (headers: IHeaders | undefined): Record<string, string> =>
    Object.fromEntries(
        Object.entries(headers ?? {}).flatMap(([name, value]) =>
            value === undefined ? [] : [[name, Array.isArray(value) ? textOf(value[0]) : textOf(value)] as const],
        ),
    )

@Injectable()
/**
 * The Kafka adapter of the event transport and the health probe of the broker; the only file that imports the broker library.
 * One producer sends every outbound message, one consumer of the app's group reads the registered topics, and a short-lived
 * consumer of its own group reads a whole topic for the operator calls.
 */
export class KafkaEventTransportClient implements EventTransport, Probe, OnApplicationShutdown {
    /** The name the health report lists this probe under. */
    readonly name = "event-bus"

    private readonly kafka: Kafka
    private producer: Producer | null = null
    private consumer: Consumer | null = null
    private admin: Admin | null = null

    constructor(
        @InjectEventBusOptions() private readonly options: EventBusOptions,
        @InjectIds() private readonly ids: Ids,
    ) {
        this.kafka = new Kafka({
            clientId: options.groupId,
            brokers: [...options.brokers],
            connectionTimeout: options.timeoutMs,
            requestTimeout: options.timeoutMs,
            logLevel: logLevel.NOTHING,
        })
    }

    /** Appends the messages to their topics in one batch. */
    async send(messages: ReadonlyArray<OutboundMessage>): Promise<void> {
        const topics = [...new Set(messages.map((message) => message.topic))]
        await this.run("send", async () => {
            const producer = await this.producerOf()
            await producer.sendBatch({
                topicMessages: topics.map((topic) => ({
                    topic,
                    messages: messages
                        .filter((message) => message.topic === topic)
                        .map((message) => ({
                            key: message.key,
                            value: message.value,
                            headers: { ...message.headers },
                        })),
                })),
            })
        })
    }

    /** Starts the consumer of the app's group on the topics; messages are read from the start of a topic the group has no offset on. */
    async subscribe(subscription: EventSubscription): Promise<void> {
        await this.run("subscribe", async () => {
            const consumer = this.kafka.consumer({ groupId: this.options.groupId, allowAutoTopicCreation: true })
            this.consumer = consumer
            await consumer.connect()
            await consumer.subscribe({ topics: [...subscription.topics], fromBeginning: true })
            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    await subscription.onMessage({
                        topic,
                        partition,
                        offset: message.offset,
                        key: textOf(message.key),
                        value: textOf(message.value),
                        headers: headersOf(message.headers),
                    })
                },
            })
        })
    }

    /** How many messages of the topic the group of the app has not acknowledged yet; a topic that does not exist has none. */
    async lag(topic: string): Promise<number> {
        return this.run("lag", async () => {
            const admin = await this.adminOf()
            const { ends } = await this.endsOf(admin, topic)
            const committed = await admin.fetchOffsets({ groupId: this.options.groupId, topics: [topic] })
            const acknowledged = new Map(
                (committed[0]?.partitions ?? []).map((entry) => [entry.partition, Number(entry.offset)] as const),
            )
            return ends.reduce((sum, end) => {
                const done = acknowledged.get(end.partition) ?? -1
                return sum + Math.max(0, Number(end.high) - (done < 0 ? Number(end.low) : done))
            }, 0)
        })
    }

    /** Every message of the topic, oldest first, read by a consumer of its own group that is dropped afterwards. */
    async read(topic: string): Promise<ReadonlyArray<InboundMessage>> {
        return this.run("read", async () => {
            const admin = await this.adminOf()
            const { ends } = await this.endsOf(admin, topic)
            const expected = ends.reduce((sum, end) => sum + (Number(end.high) - Number(end.low)), 0)
            if (expected === 0) return []
            const groupId = `${this.options.groupId}.read.${this.ids.next()}`
            const reader = this.kafka.consumer({ groupId })
            const found: Array<InboundMessage> = []
            try {
                await reader.connect()
                await reader.subscribe({ topic, fromBeginning: true })
                const complete = new Promise<void>((resolve) => {
                    void reader.run({
                        eachMessage: ({ partition, message }) => {
                            found.push({
                                topic,
                                partition,
                                offset: message.offset,
                                key: textOf(message.key),
                                value: textOf(message.value),
                                headers: headersOf(message.headers),
                            })
                            if (found.length >= expected) resolve()
                            return Promise.resolve()
                        },
                    })
                })
                await Promise.race([complete, this.wait(READ_DEADLINE_MS)])
            } finally {
                await reader.disconnect()
                await this.dropGroup(admin, groupId)
            }
            return found.sort((a, b) => a.partition - b.partition || Number(a.offset) - Number(b.offset))
        })
    }

    /** Resolves after `ms` milliseconds. */
    wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /** Resolves when the broker answers a metadata request. */
    async check(): Promise<void> {
        await this.run("check", async () => {
            await (await this.adminOf()).listTopics()
        })
    }

    /** Disconnects the producer, the consumer and the admin client. */
    async onApplicationShutdown(): Promise<void> {
        for (const client of [this.producer, this.consumer, this.admin]) await this.close(client)
    }

    /** The end offsets of the topic; a topic that does not exist yet answers no partitions and the cause. */
    private async endsOf(admin: Admin, topic: string): Promise<TopicEnds> {
        try {
            return { ends: await admin.fetchTopicOffsets(topic), cause: null }
        } catch (cause) {
            return { ends: [], cause }
        }
    }

    /** Deletes the consumer group of a read; a group the broker already dropped is not a failure of the read. */
    private async dropGroup(admin: Admin, groupId: string): Promise<unknown> {
        try {
            await admin.deleteGroups([groupId])
            return null
        } catch (cause) {
            return cause
        }
    }

    /** Disconnects a client that was opened; the failure of a client that is already gone is the answer, not an error of the shutdown. */
    private async close(client: Pick<Producer, "disconnect"> | null): Promise<unknown> {
        try {
            await client?.disconnect()
            return null
        } catch (cause) {
            return cause
        }
    }

    private async producerOf(): Promise<Producer> {
        if (this.producer === null) {
            const producer = this.kafka.producer({ allowAutoTopicCreation: true })
            await producer.connect()
            this.producer = producer
        }
        return this.producer
    }

    private async adminOf(): Promise<Admin> {
        if (this.admin === null) {
            const admin = this.kafka.admin()
            await admin.connect()
            this.admin = admin
        }
        return this.admin
    }

    private async run<TResult>(operation: string, call: () => Promise<TResult>): Promise<TResult> {
        try {
            return await call()
        } catch (cause) {
            throw new EventBusError({ code: EventBusErrorCode.BrokerUnavailable, params: { operation }, cause })
        }
    }
}
