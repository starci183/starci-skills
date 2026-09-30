import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { PlanError, PlanErrorCode } from "@modules/domain/plan"
import type { Principal } from "@modules/platform/cqrs"
import { ReconcilePaymentCommand } from "../../application/reconcile-payment.command"
import { ReconcilePaymentResolver } from "./reconcile-payment.resolver"

const principal: Principal = { id: "p1", roles: ["member"] }

describe("ReconcilePaymentResolver", () => {
    it("dispatches one reconcile command carrying the principal and answers what the gateway said", async () => {
        const value = { gatewayStatus: "paid", applied: true, subscriptionStatus: "active" }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value }) })
        await expect(new ReconcilePaymentResolver(commandBus).reconcilePayment(principal, { paymentIntentId: "i1" })).resolves.toEqual(value)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new ReconcilePaymentCommand({ request: { paymentIntentId: "i1" }, principal }),
        )
    })

    it("turns the refusal for somebody else's intent into the plan error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: PlanErrorCode.Forbidden }),
        })
        const call = new ReconcilePaymentResolver(commandBus).reconcilePayment(principal, { paymentIntentId: "i1" })
        await expect(call).rejects.toBeInstanceOf(PlanError)
        await expect(call).rejects.toMatchObject({ code: PlanErrorCode.Forbidden })
    })
})
