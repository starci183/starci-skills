import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Kafka, logLevel } from "kafkajs"
import type { Admin, Consumer, EachMessagePayload, KafkaMessage, Producer } from "kafkajs"
import { IDS } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { EventBusErrorCode } from "./errors/event-bus.error"
import { EVENT_BUS_OPTIONS } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"
import { KafkaEventTransportClient } from "./kafka-event-transport.client"
import type { EventSubscription, OutboundMessage } from "./event-transport.port"

jest.mock("kafkajs")

const KafkaMock = jest.mocked(Kafka)

const options: EventBusOptions = {
    brokers: ["broker-1.test:9092", "broker-2.test:9092"],
    groupId: "orders",
    topicPrefix: "run-1.",
    relayIntervalMs: 100,
    relayBatch: 50,
    timeoutMs: 3000,
    connections: [],
}

const payload = (partition: number, offset: string, overrides: Partial<KafkaMessage> = {}): EachMessagePayload =>
    mock<EachMessagePayload>({
        topic: "run-1.events.orders",
        partition,
        message: mock<KafkaMessage>({
            offset,
            key: Buffer.from(`key-${offset}`),
            value: Buffer.from(`value-${offset}`),
            headers: {},
            ...overrides,
        }),
    })

const build = async () => {
    const kafka = mock<InstanceType<typeof Kafka>>()
    const producer = mock<Producer>()
    const consumer = mock<Consumer>()
    const admin = mock<Admin>()
    const ids = mock<Ids>()
    ids.next.mockReturnValue("reader-1")
    kafka.producer.mockReturnValue(producer)
    kafka.consumer.mockReturnValue(consumer)
    kafka.admin.mockReturnValue(admin)
    KafkaMock.mockImplementation(() => kafka)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KafkaEventTransportClient,
            { provide: EVENT_BUS_OPTIONS, useValue: options },
            { provide: IDS, useValue: ids },
        ],
    }).compile()
    return {
        client: moduleRef.get(KafkaEventTransportClient),
        kafka,
        producer,
        consumer,
        admin,
        ids,
    }
}

describe("KafkaEventTransportClient", () => {
    beforeEach(() => {
        KafkaMock.mockReset()
    })

    it("configures Kafka and sends one batch grouped by topic through a cached producer", async () => {
        const { client, kafka, producer } = await build()
        const messages: ReadonlyArray<OutboundMessage> = [
            {
                topic: "events.orders",
                key: "order-1",
                value: "one",
                headers: { attempt: "1" },
            },
            { topic: "events.payments", key: "payment-1", value: "two", headers: {} },
            { topic: "events.orders", key: "order-2", value: "three", headers: {} },
        ]

        await client.send(messages)
        await client.send(messages.slice(0, 1))

        expect(KafkaMock).toHaveBeenCalledWith({
            clientId: "orders",
            brokers: ["broker-1.test:9092", "broker-2.test:9092"],
            connectionTimeout: 3000,
            requestTimeout: 3000,
            logLevel: logLevel.NOTHING,
        })
        expect(kafka.producer).toHaveBeenCalledTimes(1)
        expect(producer.connect).toHaveBeenCalledTimes(1)
        expect(producer.sendBatch).toHaveBeenNthCalledWith(1, {
            topicMessages: [
                {
                    topic: "events.orders",
                    messages: [
                        { key: "order-1", value: "one", headers: { attempt: "1" } },
                        { key: "order-2", value: "three", headers: {} },
                    ],
                },
                {
                    topic: "events.payments",
                    messages: [{ key: "payment-1", value: "two", headers: {} }],
                },
            ],
        })
    })

    it("wraps a broker failure with the operation that failed", async () => {
        const { client, producer } = await build()
        const failure = new Error("broker down")
        producer.sendBatch.mockRejectedValue(failure)

        await expect(
            client.send([{ topic: "events.orders", key: "order-1", value: "one", headers: {} }]),
        ).rejects.toMatchObject({
            code: EventBusErrorCode.BrokerUnavailable,
            params: { operation: "send" },
            cause: failure,
        })
    })

    it("subscribes from the beginning and maps Kafka buffers and headers into an inbound message", async () => {
        const { client, consumer } = await build()
        const subscription = mock<EventSubscription>({
            topics: ["events.orders", "events.orders.retry"],
        })
        subscription.onMessage.mockResolvedValue(undefined)

        await client.subscribe(subscription)

        expect(consumer.subscribe).toHaveBeenCalledWith({
            topics: ["events.orders", "events.orders.retry"],
            fromBeginning: true,
        })
        const eachMessage = consumer.run.mock.calls[0]?.[0].eachMessage
        await eachMessage?.(
            payload(2, "7", {
                value: null,
                headers: {
                    attempt: Buffer.from("2"),
                    copies: [Buffer.from("first"), Buffer.from("second")],
                    text: "plain",
                    omitted: undefined,
                    empty: [],
                },
            }),
        )

        expect(subscription.onMessage).toHaveBeenCalledWith({
            topic: "run-1.events.orders",
            partition: 2,
            offset: "7",
            key: "key-7",
            value: "",
            headers: { attempt: "2", copies: "first", text: "plain", empty: "" },
        })
    })

    it("computes lag from committed offsets and caches the admin client", async () => {
        const { client, kafka, admin } = await build()
        admin.fetchTopicOffsets.mockResolvedValue([
            { partition: 0, low: "2", high: "5" },
            { partition: 1, low: "4", high: "9" },
            { partition: 2, low: "0", high: "2" },
        ])
        admin.fetchOffsets.mockResolvedValue([
            {
                topic: "events.orders",
                partitions: [
                    { partition: 0, offset: "3", metadata: null },
                    { partition: 1, offset: "12", metadata: null },
                ],
            },
        ])

        await expect(client.lag("events.orders")).resolves.toBe(4)
        await expect(client.lag("events.orders")).resolves.toBe(4)

        expect(kafka.admin).toHaveBeenCalledTimes(1)
        expect(admin.connect).toHaveBeenCalledTimes(1)
    })

    it("answers zero lag when the broker does not know the topic or the group has no offsets", async () => {
        const { client, admin } = await build()
        admin.fetchTopicOffsets.mockRejectedValue(new Error("unknown topic"))
        admin.fetchOffsets.mockResolvedValue([])

        await expect(client.lag("events.missing")).resolves.toBe(0)
    })

    it("answers no messages without creating a reader when the topic is empty", async () => {
        const { client, kafka, admin } = await build()
        admin.fetchTopicOffsets.mockResolvedValue([{ partition: 0, low: "4", high: "4" }])

        await expect(client.read("events.orders")).resolves.toEqual([])

        expect(kafka.consumer).not.toHaveBeenCalled()
    })

    it("reads a whole topic, normalizes missing headers and returns messages in partition-offset order", async () => {
        const { client, kafka, admin, ids } = await build()
        const reader = mock<Consumer>()
        kafka.consumer.mockReturnValue(reader)
        admin.fetchTopicOffsets.mockResolvedValue([
            { partition: 0, low: "0", high: "2" },
            { partition: 1, low: "5", high: "6" },
        ])
        reader.run.mockImplementation(async ({ eachMessage }) => {
            await eachMessage(payload(1, "5", { headers: undefined }))
            await eachMessage(payload(0, "10", { headers: undefined }))
            await eachMessage(payload(0, "2", { headers: undefined }))
        })
        jest.spyOn(client, "wait").mockReturnValue(new Promise(() => undefined))

        await expect(client.read("events.orders")).resolves.toEqual([
            expect.objectContaining({ partition: 0, offset: "2", headers: {} }),
            expect.objectContaining({ partition: 0, offset: "10", headers: {} }),
            expect.objectContaining({ partition: 1, offset: "5", headers: {} }),
        ])

        expect(kafka.consumer).toHaveBeenCalledWith({
            groupId: "orders.read.reader-1",
        })
        expect(ids.next).toHaveBeenCalledTimes(1)
        expect(reader.disconnect).toHaveBeenCalledTimes(1)
        expect(admin.deleteGroups).toHaveBeenCalledWith(["orders.read.reader-1"])
    })

    it("keeps the messages when deleting the short-lived reader group fails", async () => {
        const { client, kafka, admin } = await build()
        const reader = mock<Consumer>()
        kafka.consumer.mockReturnValue(reader)
        admin.fetchTopicOffsets.mockResolvedValue([{ partition: 0, low: "0", high: "1" }])
        admin.deleteGroups.mockRejectedValue(new Error("group already gone"))
        reader.run.mockImplementation(({ eachMessage }) => eachMessage(payload(0, "0")))
        jest.spyOn(client, "wait").mockReturnValue(new Promise(() => undefined))

        await expect(client.read("events.orders")).resolves.toHaveLength(1)
    })

    it("waits for the requested delay", async () => {
        jest.useFakeTimers()
        try {
            const { client } = await build()

            const waiting = client.wait(250)
            await jest.advanceTimersByTimeAsync(250)

            await expect(waiting).resolves.toBeUndefined()
        } finally {
            jest.useRealTimers()
        }
    })

    it("checks broker metadata and disconnects every opened client while swallowing disconnect failures", async () => {
        const { client, producer, consumer, admin } = await build()
        await client.send([])
        await client.subscribe(mock<EventSubscription>({ topics: [] }))
        await client.check()
        consumer.disconnect.mockRejectedValue(new Error("already disconnected"))

        await expect(client.onApplicationShutdown()).resolves.toBeUndefined()

        expect(admin.listTopics).toHaveBeenCalledTimes(1)
        expect(producer.disconnect).toHaveBeenCalledTimes(1)
        expect(consumer.disconnect).toHaveBeenCalledTimes(1)
        expect(admin.disconnect).toHaveBeenCalledTimes(1)
    })

    it("shuts down cleanly before any broker client was opened", async () => {
        const { client } = await build()

        await expect(client.onApplicationShutdown()).resolves.toBeUndefined()
    })
})
