import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { DowngradePlanCommand } from "../../application/downgrade-plan.command"
import { DowngradePlanResolver } from "./downgrade-plan.resolver"

const principal: Principal = { id: "p1", roles: ["member"] }

describe("DowngradePlanResolver", () => {
    it("dispatches one downgrade command carrying the principal and answers the subscription", async () => {
        const downgraded = { subscriptionId: "s1", plan: "free", status: "free" }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue(downgraded) })
        await expect(new DowngradePlanResolver(commandBus).downgradePlan(principal)).resolves.toEqual(downgraded)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new DowngradePlanCommand({ request: {}, principal }))
    })
})
