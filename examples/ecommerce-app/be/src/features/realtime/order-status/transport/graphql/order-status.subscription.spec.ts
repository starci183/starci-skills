import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { orderStatusTopic } from "@modules/domain/order"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub, RealtimeTopic } from "@modules/platform/realtime"
import { OrderStatusSubscription } from "./order-status.subscription"

const emptyStream = (): AsyncIterable<never> => (async function* () {})()

/** A hub whose subscribe records the names of the topics it was asked for and answers one stream. */
const hubAnswering = (stream: AsyncIterable<never>) => {
    const topics: Array<string> = []
    const hub = mock<RealtimeHub>({
        subscribe: <T extends object>(topic: RealtimeTopic<T>): AsyncIterable<T> => {
            topics.push(topic.name)
            return stream
        },
    })
    return { hub, topics }
}

const build = async (hub: RealtimeHub) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OrderStatusSubscription, { provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return moduleRef.get(OrderStatusSubscription)
}

describe("OrderStatusSubscription", () => {
    describe("orderStatusChanged", () => {
        it("subscribes the client to the topic of its own principal and order and returns the hub stream", async () => {
            const frames = emptyStream()
            const { hub, topics } = hubAnswering(frames)
            const door = await build(hub)

            const stream = door.orderStatusChanged({ id: "b-1", roles: ["member"] }, { orderId: "o-1" })

            expect(stream).toBe(frames)
            expect(topics).toEqual([orderStatusTopic("b-1", "o-1").name])
        })

        it("subscribes another principal to another topic, so it cannot receive the first buyer's frames", async () => {
            const { hub, topics } = hubAnswering(emptyStream())
            const door = await build(hub)

            door.orderStatusChanged({ id: "b-2", roles: ["member"] }, { orderId: "o-1" })

            expect(topics).toEqual(["order-status:b-2:o-1"])
        })
    })
})
