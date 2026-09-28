import {
    Test 
} from "@nestjs/testing"
import {
    EntityManager 
} from "typeorm"
import {
    PaymentEntity 
} from "@modules/platform/databases/postgresql/order/entities/payment.entity"
import {
    PaymentService 
} from "./payment.service"

describe("PaymentService - sds.checkout.order-flow t-pay",
    () => {
        const paymentRepository = {
            save: jest.fn() 
        }
        const manager = {
            getRepository: jest.fn((entity: unknown) => (entity === PaymentEntity ? paymentRepository : undefined)),
        } as unknown as EntityManager
        let service: PaymentService

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [PaymentService] 
            }).compile()
            service = moduleRef.get(PaymentService)
        })

        it("capture writes the ledger row inside the caller's transaction, keyed by the order id",
            async () => {
                paymentRepository.save.mockImplementation(async (payment: PaymentEntity) => ({
                    ...payment, id: "payment-1" 
                }))

                const result = await service.capture(manager,
                    "person-1",
                    "order-1",
                    2598)

                expect(manager.getRepository).toHaveBeenCalledWith(PaymentEntity)
                const saved = paymentRepository.save.mock.calls[0][0] as PaymentEntity
                expect(saved).toMatchObject({
                    personId: "person-1",
                    orderId: "order-1",
                    amountMinorUnits: 2598,
                    idempotencyKey: "order-1",
                    status: "captured",
                })
                expect(result).toEqual({
                    paymentId: "payment-1", status: "captured", amountMinorUnits: 2598 
                })
            })

        it("a second capture of the same order surfaces the ledger's unique refusal instead of paying twice",
            async () => {
                const duplicate = new Error("duplicate key value violates unique constraint \"payment_idempotency_key_key\"")
                paymentRepository.save.mockRejectedValue(duplicate)
                await expect(service.capture(manager,
                    "person-1",
                    "order-1",
                    2598)).rejects.toBe(duplicate)
            })

        it("a persistence failure that is not the idempotency refusal propagates unchanged",
            async () => {
                const failure = new Error("connection lost mid-write")
                paymentRepository.save.mockRejectedValue(failure)
                await expect(service.capture(manager,
                    "person-1",
                    "order-1",
                    2598)).rejects.toBe(failure)
            })
    })
