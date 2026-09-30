import { mockEntityManager } from "@tests/fixtures/database"
import { PaymentService } from "./payment.service"
import { PaymentEntity } from "./persistence/entities/payment.entity"

const payment = (): PaymentEntity =>
    Object.assign(new PaymentEntity(), {
        id: "pay-1",
        personId: "p-1",
        orderId: "o-1",
        amountMinorUnits: 500,
        status: "captured",
    })

describe("PaymentService", () => {
    it("records a captured payment through the caller manager, keyed by the order", async () => {
        const manager = mockEntityManager({
            create: jest.fn().mockReturnValue(payment()),
            save: jest.fn().mockResolvedValue(payment()),
        })
        const view = await new PaymentService(mockEntityManager()).capture({
            manager,
            personId: "p-1",
            orderId: "o-1",
            amountMinorUnits: 500,
        })
        expect(view).toEqual({ paymentId: "pay-1", amountMinorUnits: 500 })
        expect(manager.create).toHaveBeenCalledWith(PaymentEntity, {
            personId: "p-1",
            orderId: "o-1",
            amountMinorUnits: 500,
            status: "captured",
        })
    })

    it("finds the payment of an order with the injected manager, or with the caller manager when handed one", async () => {
        const injected = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(payment()) })
        const caller = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
        const service = new PaymentService(injected)
        await expect(service.findByOrder({ orderId: "o-1" })).resolves.toEqual({
            paymentId: "pay-1",
            amountMinorUnits: 500,
        })
        await expect(service.findByOrder({ orderId: "o-2", manager: caller })).resolves.toBeNull()
        expect(caller.findOneBy).toHaveBeenCalledWith(PaymentEntity, { orderId: "o-2" })
    })
})
