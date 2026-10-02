import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { orderStatusTopic } from "./order-status.policy"
import { OrderStatusService } from "./order-status.service"

const build = async () => {
    const hub = mock<RealtimeHub>()
    const moduleRef = await Test.createTestingModule({
        providers: [OrderStatusService, { provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return { service: moduleRef.get(OrderStatusService), hub }
}

describe("OrderStatusService", () => {
    describe("push", () => {
        it("publishes one frame to the channel of the order's buyer", async () => {
            const { service, hub } = await build()

            service.push({ personId: "p-1", orderId: "o-1", status: "paid", changedAt: "2026-02-03T04:05:06.000Z" })

            expect(hub.publish).toHaveBeenCalledTimes(1)
            expect(hub.publish).toHaveBeenCalledWith(expect.objectContaining({ name: orderStatusTopic("p-1", "o-1").name }), {
                orderId: "o-1",
                status: "paid",
                changedAt: "2026-02-03T04:05:06.000Z",
            })
        })

        it("publishes to a different channel for a different buyer of the same order id", async () => {
            const { service, hub } = await build()

            service.push({ personId: "p-2", orderId: "o-1", status: "expired", changedAt: "2026-02-03T04:05:06.000Z" })

            expect(hub.publish).toHaveBeenCalledWith(expect.objectContaining({ name: "order-status:p-2:o-1" }), expect.anything())
        })
    })
})
