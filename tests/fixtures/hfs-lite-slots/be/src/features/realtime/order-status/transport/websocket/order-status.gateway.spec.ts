import { orderStatusTopic } from "@modules/domain/order"
import type { RealtimeHub } from "@modules/platform/realtime"
import { OrderStatusGateway } from "./order-status.gateway"

// The repository fixture spec also proves the actual hub and authentication lifecycle.
describe("OrderStatusGateway", () => {
    it("subscribes through the verified principal's domain topic", () => {
        const stream = { async *[Symbol.asyncIterator]() { yield { id: "o-1" } } }
        const subscribe = jest.fn().mockReturnValue(stream)
        const hub = { subscribe } as unknown as RealtimeHub
        const gateway = new OrderStatusGateway(hub)

        expect(gateway.frames({ id: "buyer-1", role: "authenticated" })).toBe(stream)
        expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ name: orderStatusTopic("buyer-1").name }))
    })
})
