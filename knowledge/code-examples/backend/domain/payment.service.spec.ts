// Imports the host resolves:
//   import { mock } from "@starci/jest-preset"
//   import { Test } from "@nestjs/testing"

describe("PaymentService", () => {
    it("publishes PaymentSettledEvent with the transaction manager, after the settle statement", async () => {
        const { service, manager, eventBus } = await build()

        await service.settle("p-1", "o-1")

        expect(manager.query).toHaveBeenCalledTimes(1)
        expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ eventName: "payment.settled" }), manager)
    })
})
