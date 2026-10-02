import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { orderStatusTopic } from "@modules/domain/order"
import type { OrderStatusFrame } from "@modules/domain/order"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { OrderStatusSubscription } from "./order-status.subscription"

const build = async (hub: RealtimeHub) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OrderStatusSubscription, { provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return moduleRef.get(OrderStatusSubscription)
}

const emptyStream = (): AsyncIterable<OrderStatusFrame> => (async function* () {})()

describe("OrderStatusSubscription", () => {
    describe("orderStatusChanged", () => {
        it("subscribes the client to the topic of its own principal and order and returns the hub stream", async () => {
            const frames = emptyStream()
            const hub = mock<RealtimeHub>({ subscribe: jest.fn(() => frames) })
            const door = await build(hub)

            const stream = door.orderStatusChanged({ id: "b-1", roles: ["member"] }, { orderId: "o-1" })

            expect(stream).toBe(frames)
            expect(hub.subscribe).toHaveBeenCalledTimes(1)
            expect(hub.subscribe).toHaveBeenCalledWith(expect.objectContaining({ name: orderStatusTopic("b-1", "o-1").name }))
        })

        it("subscribes another principal to another topic, so it cannot receive the first buyer's frames", async () => {
            const hub = mock<RealtimeHub>({ subscribe: jest.fn(() => emptyStream()) })
            const door = await build(hub)

            door.orderStatusChanged({ id: "b-2", roles: ["member"] }, { orderId: "o-1" })

            expect(hub.subscribe).toHaveBeenCalledWith(expect.objectContaining({ name: "order-status:b-2:o-1" }))
            expect(hub.subscribe).not.toHaveBeenCalledWith(expect.objectContaining({ name: "order-status:b-1:o-1" }))
        })
    })
})
