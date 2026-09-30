import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { GetCartQuery } from "../../application/get-cart.query"
import { CartResolver } from "./cart.resolver"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("CartResolver", () => {
    it("dispatches one cart query carrying the principal and answers the view", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ items: [], catalog: [] }) })
        await expect(new CartResolver(queryBus).cart(principal)).resolves.toEqual({ items: [], catalog: [] })
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new GetCartQuery({ request: {}, principal }))
    })
})
