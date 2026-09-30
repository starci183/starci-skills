import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { UpgradePlanCommand } from "../../application/upgrade-plan.command"
import { UpgradePlanResolver } from "./upgrade-plan.resolver"

const principal: Principal = { id: "p1", roles: ["member"] }

describe("UpgradePlanResolver", () => {
    it("dispatches one upgrade command carrying the principal and answers the checkout", async () => {
        const opened = { subscriptionId: "s1", paymentIntentId: "i1", checkoutUrl: "https://pay.test/g1", status: "pending" }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue(opened) })
        await expect(new UpgradePlanResolver(commandBus).upgradePlan(principal)).resolves.toEqual(opened)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new UpgradePlanCommand({ request: {}, principal }))
    })
})
