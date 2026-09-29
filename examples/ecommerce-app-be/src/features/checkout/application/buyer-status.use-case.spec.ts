import {
    BuyerStatusResult, OrderService
} from "ecommerce-app-be/modules/domain/order"
import {
    BuyerStatusUseCase
} from "./buyer-status.use-case"

describe("BuyerStatusUseCase",
    () => {
        const orders = {
            buyerStatus: jest.fn()
        }
        const useCase = new BuyerStatusUseCase(orders as unknown as OrderService)

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
