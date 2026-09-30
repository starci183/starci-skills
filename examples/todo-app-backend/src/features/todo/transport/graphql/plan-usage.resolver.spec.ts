import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { PlanUsageQuery } from "../../application/plan-usage.query"
import { PlanUsageResolver } from "./plan-usage.resolver"

const principal: Principal = { id: "p1", roles: ["member"] }

describe("PlanUsageResolver", () => {
    it("dispatches one usage query carrying the principal and answers the usage", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ plan: "free", cap: 20, activeCount: 3 }) })
        await expect(new PlanUsageResolver(queryBus).planUsage(principal)).resolves.toEqual({ plan: "free", cap: 20, activeCount: 3 })
        expect(queryBus.execute).toHaveBeenCalledWith(new PlanUsageQuery({ request: {}, principal }))
    })
})
