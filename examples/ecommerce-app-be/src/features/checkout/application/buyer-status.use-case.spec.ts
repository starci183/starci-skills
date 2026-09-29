import {
    mock 
} from "@starci/jest-preset/mock"
import {
    OrderService 
} from "@modules/domain/order/index"
import type {
    BuyerStatusResult 
} from "@modules/domain/order/index"
import {
    BuyerStatusUseCase
} from "./buyer-status.use-case"

describe("BuyerStatusUseCase",
    () => {
        const orders = mock<OrderService>()
        const useCase = new BuyerStatusUseCase(orders)

        it("answers what the order capability answers for the person",
            async () => {
                const answer: BuyerStatusResult = {
                    personId: "person-1", hasOrders: false
                }
                orders.buyerStatus.mockResolvedValue(answer)
                await expect(useCase.execute("person-1")).resolves.toEqual(answer)
                expect(orders.buyerStatus).toHaveBeenCalledWith("person-1")
            })
    })
