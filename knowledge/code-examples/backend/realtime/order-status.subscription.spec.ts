import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { orderStatusTopic } from "@modules/domain/order"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { OrderStatusSubscription } from "./order-status.subscription"

const build = async (hub: RealtimeHub) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OrderStatusSubscription, { provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return moduleRef.get(OrderStatusSubscription)
}

describe("OrderStatusSubscription", () => {
    it("subscribes the client to the topic of its own principal and order", async () => {
        const frames = (async function* () {})()
        const hub = mock<RealtimeHub>({ subscribe: jest.fn(() => frames) })
        const door = await build(hub)

        const stream = door.orderStatusChanged({ id: "b-1", roles: [] }, "o-1")

        expect(stream).toBe(frames)
        expect(hub.subscribe).toHaveBeenCalledWith(expect.objectContaining({ name: orderStatusTopic("b-1", "o-1").name }))
    })

    it("uses another topic for another principal", async () => {
        const hub = mock<RealtimeHub>({ subscribe: jest.fn(() => (async function* () {})()) })
        const door = await build(hub)

        door.orderStatusChanged({ id: "b-2", roles: [] }, "o-1")

        expect(hub.subscribe).toHaveBeenCalledWith(expect.objectContaining({ name: orderStatusTopic("b-2", "o-1").name }))
    })
})
