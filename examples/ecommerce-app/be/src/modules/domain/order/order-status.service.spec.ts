import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { OrderStatusService } from "./order-status.service"

const AT = "2026-02-03T04:05:06.000Z"

const build = async (claimed = true) => {
    const inbox = mock<Inbox>()
    inbox.claim.mockResolvedValue(claimed)
    const hub = mock<RealtimeHub>()
    const moduleRef = await Test.createTestingModule({
        providers: [OrderStatusService, { provide: INBOX, useValue: inbox }, { provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return { service: moduleRef.get(OrderStatusService), inbox, hub }
}

describe("OrderStatusService", () => {
    describe("push", () => {
        it("claims the event first, then publishes one frame to the channel of the order's buyer", async () => {
            const { service, inbox, hub } = await build()

            await service.push({ eventId: "o-1", personId: "p-1", orderId: "o-1", status: "paid", changedAt: AT })

            expect(inbox.claim).toHaveBeenCalledWith("order-status-push", "o-1")
            expect(hub.publish.mock.calls).toHaveLength(1)
            expect(hub.publish.mock.calls[0]?.[0]).toMatchObject({ name: "order-status:p-1:o-1" })
            expect(hub.publish.mock.calls[0]?.[1]).toEqual({ orderId: "o-1", status: "paid", changedAt: AT })
        })

        it("publishes to a different channel for a different buyer of the same order id", async () => {
            const { service, hub } = await build()

            await service.push({ eventId: "o-1", personId: "p-2", orderId: "o-1", status: "expired", changedAt: AT })

            expect(hub.publish.mock.calls.map((call) => call[0].name)).toEqual(["order-status:p-2:o-1"])
        })

        it("pushes nothing for a redelivered event", async () => {
            const { service, hub } = await build(false)

            await service.push({ eventId: "o-1", personId: "p-1", orderId: "o-1", status: "paid", changedAt: AT })

            expect(hub.publish.mock.calls).toEqual([])
        })
    })
})
