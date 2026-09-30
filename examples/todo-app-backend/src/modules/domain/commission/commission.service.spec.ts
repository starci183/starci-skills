import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { accrueInput, COMMISSION_AT, commissionRow } from "@tests/fixtures/builders/commission.builder"
import { CommissionService } from "./commission.service"
import { CommissionErrorCode } from "./errors/commission.error"
import { CommissionEntity } from "./persistence/entities/commission.entity"

const at = new Date(COMMISSION_AT)

const build = async (em = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            CommissionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(COMMISSION_AT) },
        ],
    }).compile()
    return { service: moduleRef.get(CommissionService), em }
}

describe("CommissionService", () => {
    describe("accrue", () => {
        it("accrues 30% of the paid amount, rounded down, stamped with the clock", async () => {
            const { service, em } = await build(
                mockEntityManager({ findOneBy: [CommissionEntity, null], save: [CommissionEntity, commissionRow()] }),
            )

            await expect(service.accrue(accrueInput())).resolves.toSucceedWith({
                id: "c-1",
                referrerId: "ref-1",
                buyerId: "buyer-1",
                paymentId: "pay-1",
                amount: 29_999,
                accruedAt: at,
            })

            expect(em.findOneBy).toHaveBeenCalledWith(CommissionEntity, { paymentId: "pay-1" })
            expect(em.save).toHaveBeenCalledWith(CommissionEntity, {
                id: expect.any(String),
                referrerId: "ref-1",
                buyerId: "buyer-1",
                paymentId: "pay-1",
                amount: 29_999,
                accruedAt: at,
            })
        })

        it("refuses a self referral without touching the database", async () => {
            const { service } = await build()

            await expect(service.accrue(accrueInput({ referrerId: "buyer-1" }))).resolves.toBeRefused({
                code: CommissionErrorCode.SelfReferral,
                params: { personId: "buyer-1" },
            })
        })

        it("returns the existing accrual for a duplicate and saves nothing", async () => {
            const { service, em } = await build(mockEntityManager({ findOneBy: [CommissionEntity, commissionRow()] }))

            await expect(service.accrue(accrueInput())).resolves.toSucceedWith({
                id: "c-1",
                referrerId: "ref-1",
                buyerId: "buyer-1",
                paymentId: "pay-1",
                amount: 29_999,
                accruedAt: at,
            })

            expect(em.save).not.toHaveBeenCalled()
        })
    })
})
