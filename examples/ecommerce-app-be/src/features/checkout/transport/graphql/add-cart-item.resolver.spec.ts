import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { OrderError, OrderErrorCode } from "@modules/domain/order"
import type { Principal } from "@modules/platform/cqrs"
import { AddCartItemCommand } from "../../application/add-cart-item.command"
import { AddCartItemResolver } from "./add-cart-item.resolver"

const principal: Principal = { id: "p-1", roles: ["member"] }
const input = { productId: "mug", quantity: 2 }

describe("AddCartItemResolver", () => {
    it("dispatches one add command carrying the principal and answers the merged line", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { productId: "mug", quantity: 5 } }),
        })
        await expect(new AddCartItemResolver(commandBus).addCartItem(principal, input)).resolves.toEqual({
            item: { productId: "mug", quantity: 5 },
        })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new AddCartItemCommand({ request: input, principal }))
    })

    it("turns the refusal of an unknown product into the order error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest
                .fn()
                .mockResolvedValue({
                    kind: "refused",
                    code: OrderErrorCode.UnknownProduct,
                    params: { productId: "ghost" },
                }),
        })
        await expect(new AddCartItemResolver(commandBus).addCartItem(principal, input)).rejects.toBeInstanceOf(
            OrderError,
        )
    })
})
