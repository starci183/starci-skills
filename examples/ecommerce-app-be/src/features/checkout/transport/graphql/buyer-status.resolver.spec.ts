import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { GetBuyerStatusQuery } from "../../application/get-buyer-status.query"
import { BuyerStatusResolver } from "./buyer-status.resolver"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("BuyerStatusResolver", () => {
    it("dispatches one buyer status query carrying the principal and answers the status", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ personId: "p-1", hasOrders: true }) })
        await expect(new BuyerStatusResolver(queryBus).buyerStatus(principal)).resolves.toEqual({ personId: "p-1", hasOrders: true })
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new GetBuyerStatusQuery({ request: {}, principal }))
    })
})
