import { Test } from "@nestjs/testing"
import { MemoryRealtimeHubService } from "./memory-realtime-hub.service"
import type { RealtimeTopic } from "./realtime.port"

interface StatusFrame {
    readonly orderId: string
    readonly status: string
}

const isStatusFrame = (value: unknown): value is StatusFrame =>
    typeof value === "object" && value !== null && "orderId" in value && "status" in value

const topicOf = (name: string): RealtimeTopic<StatusFrame> => ({ name, accepts: isStatusFrame })

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [MemoryRealtimeHubService] }).compile()
    return moduleRef.get(MemoryRealtimeHubService)
}

describe("MemoryRealtimeHubService", () => {
    describe("publish and subscribe", () => {
        it("delivers a published frame to every open subscription of the topic, in order", async () => {
            const hub = await build()
            const first = hub.subscribe(topicOf("order-status:b-1:o-1"))[Symbol.asyncIterator]()
            const second = hub.subscribe(topicOf("order-status:b-1:o-1"))[Symbol.asyncIterator]()

            hub.publish(topicOf("order-status:b-1:o-1"), { orderId: "o-1", status: "paid" })
            hub.publish(topicOf("order-status:b-1:o-1"), { orderId: "o-1", status: "shipped" })

            expect(await first.next()).toEqual({ done: false, value: { orderId: "o-1", status: "paid" } })
            expect(await first.next()).toEqual({ done: false, value: { orderId: "o-1", status: "shipped" } })
            expect(await second.next()).toEqual({ done: false, value: { orderId: "o-1", status: "paid" } })
        })

        it("waits for a frame that is published after the read started", async () => {
            const hub = await build()
            const stream = hub.subscribe(topicOf("order-status:b-1:o-1"))[Symbol.asyncIterator]()

            const pending = stream.next()
            hub.publish(topicOf("order-status:b-1:o-1"), { orderId: "o-1", status: "paid" })

            expect(await pending).toEqual({ done: false, value: { orderId: "o-1", status: "paid" } })
        })

        it("delivers nothing to another topic and drops a frame nobody listens to", async () => {
            const hub = await build()
            const other = hub.subscribe(topicOf("order-status:b-2:o-1"))[Symbol.asyncIterator]()

            hub.publish(topicOf("order-status:b-1:o-1"), { orderId: "o-1", status: "paid" })
            hub.publish(topicOf("order-status:b-2:o-1"), { orderId: "o-9", status: "shipped" })

            expect(await other.next()).toEqual({ done: false, value: { orderId: "o-9", status: "shipped" } })
        })

        it("never delivers a value the topic does not accept", async () => {
            const hub = await build()
            const stream = hub.subscribe(topicOf("order-status:b-1:o-1"))[Symbol.asyncIterator]()
            const untyped: RealtimeTopic<object> = {
                name: "order-status:b-1:o-1",
                accepts: (frame): frame is object => typeof frame === "object",
            }

            hub.publish(untyped, { unrelated: true })
            hub.publish(topicOf("order-status:b-1:o-1"), { orderId: "o-1", status: "paid" })

            expect(await stream.next()).toEqual({ done: false, value: { orderId: "o-1", status: "paid" } })
        })
    })

    describe("release", () => {
        it("counts open subscriptions and frees a topic when its last reader stops", async () => {
            const hub = await build()
            const topic = topicOf("order-status:b-1:o-1")
            const first = hub.subscribe(topic)[Symbol.asyncIterator]()
            const second = hub.subscribe(topic)[Symbol.asyncIterator]()
            expect(hub.subscriberCount(topic)).toBe(2)

            await first.return?.()
            expect(hub.subscriberCount(topic)).toBe(1)
            await second.return?.()

            expect(hub.subscriberCount(topic)).toBe(0)
        })

        it("ends a pending read when its reader stops and answers done afterwards", async () => {
            const hub = await build()
            const stream = hub.subscribe(topicOf("order-status:b-1:o-1"))[Symbol.asyncIterator]()

            const pending = stream.next()
            await stream.return?.()

            expect(await pending).toEqual({ done: true, value: undefined })
            expect(await stream.next()).toEqual({ done: true, value: undefined })
        })
    })
})
