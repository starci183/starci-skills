import { mock } from "@starci/jest-preset/mock"
import type { OrderService } from "@modules/domain/order"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { GetBuyerStatusHandler } from "./get-buyer-status.handler"
import { GetBuyerStatusQuery } from "./get-buyer-status.query"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("GetBuyerStatusHandler", () => {
    it("answers the buyer status of the caller", async () => {
        const orders = mock<OrderService>({
            buyerStatus: jest.fn().mockResolvedValue({ personId: "p-1", hasOrders: true }),
        })
        const handler = new GetBuyerStatusHandler(mock<Logger>(), orders)
        await expect(handler.execute(new GetBuyerStatusQuery({ request: {}, principal }))).resolves.toEqual({
            personId: "p-1",
            hasOrders: true,
        })
        expect(orders.buyerStatus).toHaveBeenCalledWith({ personId: "p-1" })
    })
})
