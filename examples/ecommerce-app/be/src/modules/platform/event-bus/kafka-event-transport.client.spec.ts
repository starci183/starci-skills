import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Kafka, logLevel } from "kafkajs"
import type { Admin, Consumer, EachMessagePayload, IHeaders, Producer } from "kafkajs"
import { IDS } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { EventBusErrorCode } from "./errors/event-bus.error"
import { EVENT_BUS_OPTIONS } from "./event-bus.decorators"
import type { EventBusOptions } from "./event-bus.options"
import type { InboundMessage, OutboundMessage } from "./event-transport.port"
import { KafkaEventTransportClient } from "./kafka-event-transport.client"

jest.mock("kafkajs", () => ({ Kafka: jest.fn(), logLevel: { NOTHING: 0 } }))

const options: EventBusOptions = {
    brokers: ["broker-1.test:9092", "broker-2.test:9092"],
    groupId: "orders",
    topicPrefix: "",
    relayIntervalMs: 100,
    relayBatch: 50,
    timeoutMs: 3000,
    connections: [],
}

const outbound = (topic: string, key: string): OutboundMessage => ({
    topic,
    key,
    value: `value-${key}`,
    headers: { attempt: "2" },
})

const eachMessagePayload = (
    partition: number,
    offset: string,
    key: Buffer | null,
    value: Buffer | null,
    headers?: IHeaders,
): EachMessagePayload => ({
    topic: "events.order",
    partition,
    message:
        headers === undefined
            ? { key, value, timestamp: "0", attributes: 0, offset, size: value?.length ?? 0 }
            : { key, value, timestamp: "0", attributes: 0, offset, headers },
    heartbeat: () => Promise.resolve(),
    pause: () => () => undefined,
})

const build = async () => {
    const kafka = mock<Kafka>()
    const producer = mock<Producer>()
    const consumer = mock<Consumer>()
    const admin = mock<Admin>()
    const ids = mock<Ids>()
    producer.connect.mockResolvedValue(undefined)
    producer.sendBatch.mockResolvedValue([])
    producer.disconnect.mockResolvedValue(undefined)
    consumer.connect.mockResolvedValue(undefined)
    consumer.subscribe.mockResolvedValue(undefined)
    consumer.run.mockResolvedValue(undefined)
    consumer.disconnect.mockResolvedValue(undefined)
    admin.connect.mockResolvedValue(undefined)
    admin.deleteGroups.mockResolvedValue([])
    admin.disconnect.mockResolvedValue(undefined)
    kafka.producer.mockReturnValue(producer)
    kafka.consumer.mockReturnValue(consumer)
    kafka.admin.mockReturnValue(admin)
    ids.next.mockReturnValue("read-1")
    jest.mocked(Kafka).mockImplementation(() => kafka)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KafkaEventTransportClient,
            { provide: EVENT_BUS_OPTIONS, useValue: options },
            { provide: IDS, useValue: ids },
        ],
    }).compile()
    return { client: moduleRef.get(KafkaEventTransportClient), kafka, producer, consumer, admin, ids }
}

describe("KafkaEventTransportClient", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("configures the Kafka client as the event-bus probe", async () => {
        const { client } = await build()

        expect(client.name).toBe("event-bus")
        expect(Kafka).toHaveBeenCalledWith({
            clientId: "orders",
            brokers: ["broker-1.test:9092", "broker-2.test:9092"],
            connectionTimeout: 3000,
            requestTimeout: 3000,
            logLevel: logLevel.NOTHING,
        })
    })

    describe("send", () => {
        it("connects one producer and batches messages by topic", async () => {
            const { client, kafka, producer } = await build()
            const first = outbound("events.order", "order-1")
            const second = outbound("events.payment", "payment-1")
            const third = outbound("events.order", "order-2")

            await client.send([first, second, third])
            await client.send([first])

            expect(kafka.producer).toHaveBeenCalledTimes(1)
            expect(producer.connect).toHaveBeenCalledTimes(1)
            expect(producer.sendBatch).toHaveBeenNthCalledWith(1, {
                topicMessages: [
                    {
                        topic: "events.order",
                        messages: [
                            { key: "order-1", value: "value-order-1", headers: { attempt: "2" } },
                            { key: "order-2", value: "value-order-2", headers: { attempt: "2" } },
                        ],
                    },
                    {
                        topic: "events.payment",
                        messages: [{ key: "payment-1", value: "value-payment-1", headers: { attempt: "2" } }],
                    },
                ],
            })
        })

        it("describes a producer failure as an unavailable broker operation", async () => {
            const { client, producer } = await build()
            const failure = new Error("broker refused the batch")
            producer.sendBatch.mockRejectedValue(failure)

            await expect(client.send([outbound("events.order", "order-1")])).rejects.toMatchObject({
                code: EventBusErrorCode.BrokerUnavailable,
                params: { operation: "send" },
                cause: failure,
            })
        })
    })

    describe("subscribe", () => {
        it("connects the app consumer and maps Kafka fields and headers to an inbound message", async () => {
            const { client, kafka, consumer } = await build()
            const onMessage = jest.fn<Promise<void>, [InboundMessage]>().mockResolvedValue(undefined)

            await client.subscribe({ topics: ["events.order", "events.order.retry"], onMessage })
            const eachMessage = consumer.run.mock.calls[0]?.[0].eachMessage
            await eachMessage?.(
                eachMessagePayload(2, "7", Buffer.from("order-1"), null, {
                    attempt: [Buffer.from("2")],
                    reason: Buffer.from("retry"),
                    plain: "yes",
                    empty: [],
                    absent: undefined,
                }),
            )

            expect(kafka.consumer).toHaveBeenCalledWith({ groupId: "orders", allowAutoTopicCreation: true })
            expect(consumer.connect).toHaveBeenCalledTimes(1)
            expect(consumer.subscribe).toHaveBeenCalledWith({
                topics: ["events.order", "events.order.retry"],
                fromBeginning: true,
            })
            expect(onMessage).toHaveBeenCalledWith({
                topic: "events.order",
                partition: 2,
                offset: "7",
                key: "order-1",
                value: "",
                headers: { attempt: "2", reason: "retry", plain: "yes", empty: "" },
            })
        })
    })

    describe("lag", () => {
        it("counts unacknowledged messages from committed offsets and partition starts", async () => {
            const { client, admin } = await build()
            admin.fetchTopicOffsets.mockResolvedValue([
                { partition: 0, low: "2", high: "10", offset: "10" },
                { partition: 1, low: "5", high: "8", offset: "8" },
                { partition: 2, low: "0", high: "2", offset: "2" },
            ])
            admin.fetchOffsets.mockResolvedValue([
                {
                    topic: "events.order",
                    partitions: [
                        { partition: 0, offset: "6", metadata: null },
                        { partition: 2, offset: "3", metadata: null },
                    ],
                },
            ])

            await expect(client.lag("events.order")).resolves.toBe(7)

            expect(admin.connect).toHaveBeenCalledTimes(1)
            expect(admin.fetchOffsets).toHaveBeenCalledWith({ groupId: "orders", topics: ["events.order"] })
        })

        it("answers zero when the broker does not know the topic", async () => {
            const { client, admin } = await build()
            admin.fetchTopicOffsets.mockRejectedValue(new Error("unknown topic"))
            admin.fetchOffsets.mockResolvedValue([])

            await expect(client.lag("events.missing")).resolves.toBe(0)
        })
    })

    describe("read", () => {
        it("answers no messages without opening a reader when the topic is empty", async () => {
            const { client, kafka, admin, ids } = await build()
            admin.fetchTopicOffsets.mockResolvedValue([])

            await expect(client.read("events.order.dlq")).resolves.toEqual([])

            expect(kafka.consumer).not.toHaveBeenCalled()
            expect(ids.next).not.toHaveBeenCalled()
        })

        it("reads the whole topic, sorts partitions and offsets, then drops its temporary group", async () => {
            const { client, kafka, consumer: reader, admin } = await build()
            admin.fetchTopicOffsets.mockResolvedValue([
                { partition: 0, low: "0", high: "2", offset: "2" },
                { partition: 1, low: "0", high: "1", offset: "1" },
            ])
            kafka.consumer.mockReturnValue(reader)
            reader.run.mockImplementation(async (config) => {
                if (config.eachMessage === undefined) return
                await config.eachMessage(eachMessagePayload(1, "0", null, Buffer.from("partition-1")))
                await config.eachMessage(
                    eachMessagePayload(0, "1", Buffer.from("key-1"), Buffer.from("offset-1"), {
                        attempt: "2",
                    }),
                )
                await config.eachMessage(
                    eachMessagePayload(0, "0", Buffer.from("key-0"), Buffer.from("offset-0"), {
                        reason: Buffer.from("failed"),
                    }),
                )
            })
            jest.spyOn(client, "wait").mockReturnValue(new Promise<void>(() => undefined))

            await expect(client.read("events.order.dlq")).resolves.toEqual([
                {
                    topic: "events.order.dlq",
                    partition: 0,
                    offset: "0",
                    key: "key-0",
                    value: "offset-0",
                    headers: { reason: "failed" },
                },
                {
                    topic: "events.order.dlq",
                    partition: 0,
                    offset: "1",
                    key: "key-1",
                    value: "offset-1",
                    headers: { attempt: "2" },
                },
                {
                    topic: "events.order.dlq",
                    partition: 1,
                    offset: "0",
                    key: "",
                    value: "partition-1",
                    headers: {},
                },
            ])
            expect(reader.disconnect).toHaveBeenCalledTimes(1)
            expect(admin.deleteGroups).toHaveBeenCalledWith(["orders.read.read-1"])
        })

        it("answers the messages found before the read deadline", async () => {
            const { client, kafka, consumer: reader, admin } = await build()
            admin.fetchTopicOffsets.mockResolvedValue([{ partition: 0, low: "0", high: "2", offset: "2" }])
            kafka.consumer.mockReturnValue(reader)
            reader.run.mockImplementation(async (config) => {
                await config.eachMessage?.(eachMessagePayload(0, "0", Buffer.from("key-0"), Buffer.from("offset-0")))
            })
            jest.spyOn(client, "wait").mockResolvedValue(undefined)

            await expect(client.read("events.order.dlq")).resolves.toHaveLength(1)
        })

        it("disconnects and tolerates group cleanup failure when opening the reader fails", async () => {
            const { client, kafka, consumer: reader, admin } = await build()
            const failure = new Error("reader unavailable")
            admin.fetchTopicOffsets.mockResolvedValue([{ partition: 0, low: "0", high: "1", offset: "1" }])
            admin.deleteGroups.mockRejectedValue(new Error("group already gone"))
            kafka.consumer.mockReturnValue(reader)
            reader.connect.mockRejectedValue(failure)

            await expect(client.read("events.order.dlq")).rejects.toMatchObject({
                code: EventBusErrorCode.BrokerUnavailable,
                params: { operation: "read" },
                cause: failure,
            })
            expect(reader.disconnect).toHaveBeenCalledTimes(1)
            expect(admin.deleteGroups).toHaveBeenCalledWith(["orders.read.read-1"])
        })
    })

    it("waits for the requested delay", async () => {
        jest.useFakeTimers()
        const { client } = await build()

        const waiting = client.wait(25)
        jest.advanceTimersByTime(25)

        await expect(waiting).resolves.toBeUndefined()
        jest.useRealTimers()
    })

    it("checks broker metadata through one connected admin client", async () => {
        const { client, kafka, admin } = await build()
        admin.listTopics.mockResolvedValue(["events.order"])

        await client.check()
        await client.check()

        expect(kafka.admin).toHaveBeenCalledTimes(1)
        expect(admin.connect).toHaveBeenCalledTimes(1)
        expect(admin.listTopics).toHaveBeenCalledTimes(2)
    })

    describe("onApplicationShutdown", () => {
        it("does nothing when no broker client was opened", async () => {
            const { client, producer, consumer, admin } = await build()

            await expect(client.onApplicationShutdown()).resolves.toBeUndefined()

            expect(producer.disconnect).not.toHaveBeenCalled()
            expect(consumer.disconnect).not.toHaveBeenCalled()
            expect(admin.disconnect).not.toHaveBeenCalled()
        })

        it("disconnects every opened client and tolerates an already-gone client", async () => {
            const { client, producer, consumer, admin } = await build()
            producer.disconnect.mockRejectedValue(new Error("producer already gone"))
            admin.listTopics.mockResolvedValue([])
            await client.send([outbound("events.order", "order-1")])
            await client.subscribe({ topics: ["events.order"], onMessage: () => Promise.resolve() })
            await client.check()

            await expect(client.onApplicationShutdown()).resolves.toBeUndefined()

            expect(producer.disconnect).toHaveBeenCalledTimes(1)
            expect(consumer.disconnect).toHaveBeenCalledTimes(1)
            expect(admin.disconnect).toHaveBeenCalledTimes(1)
        })
    })
})
