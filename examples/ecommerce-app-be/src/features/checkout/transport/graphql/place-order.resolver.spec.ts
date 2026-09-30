import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { OrderError, OrderErrorCode } from "@modules/domain/order"
import type { Principal } from "@modules/platform/cqrs"
import { PlaceOrderCommand } from "../../application/place-order.command"
import { PlaceOrderResolver } from "./place-order.resolver"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("PlaceOrderResolver", () => {
    it("dispatches one place command carrying the principal and answers the confirmation", async () => {
        const order = {
            orderId: "o-1",
            status: "confirmed",
            totalMinorUnits: 100,
            currency: "USD",
            paymentId: "pay-1",
            replayed: false,
        }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: order }) })
        await expect(
            new PlaceOrderResolver(commandBus).placeOrder(principal, { idempotencyKey: "k-1" }),
        ).resolves.toEqual(order)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new PlaceOrderCommand({ request: { idempotencyKey: "k-1" }, principal }),
        )
    })

    it("turns the refusal of an insufficient stock into the order error carrying its params", async () => {
        const params = { productId: "thermos", requested: 3, available: 2 }
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: OrderErrorCode.InsufficientStock, params }),
        })
        const call = new PlaceOrderResolver(commandBus).placeOrder(principal, {})
        await expect(call).rejects.toBeInstanceOf(OrderError)
        await expect(call).rejects.toMatchObject({ code: OrderErrorCode.InsufficientStock, params })
    })
})
