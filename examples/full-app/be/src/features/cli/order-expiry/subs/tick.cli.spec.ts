import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OrderExpiryTicksService } from "@modules/domain/order-expiry-ticks"
import { TickCli } from "./tick.cli"

describe("TickCli", () => {
    it("delegates exactly one expiry tick to the domain capability", async () => {
        const ticks = mock<OrderExpiryTicksService>()
        const moduleRef = await Test.createTestingModule({
            providers: [TickCli, { provide: OrderExpiryTicksService, useValue: ticks }],
        }).compile()

        await expect(moduleRef.get(TickCli).run()).resolves.toBeUndefined()

        expect(ticks.enqueueTick).toHaveBeenCalledTimes(1)
    })

    it("propagates a failed enqueue so the one-off command fails", async () => {
        const ticks = mock<OrderExpiryTicksService>()
        const failure = new Error("outbox write failed")
        ticks.enqueueTick.mockRejectedValue(failure)
        const moduleRef = await Test.createTestingModule({
            providers: [TickCli, { provide: OrderExpiryTicksService, useValue: ticks }],
        }).compile()

        await expect(moduleRef.get(TickCli).run()).rejects.toBe(failure)
    })
})
