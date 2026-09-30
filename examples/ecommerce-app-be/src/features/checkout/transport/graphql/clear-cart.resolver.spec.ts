import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { ClearCartCommand } from "../../application/clear-cart.command"
import { ClearCartResolver } from "./clear-cart.resolver"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("ClearCartResolver", () => {
    it("dispatches one clear command carrying the principal and confirms", async () => {
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ cleared: true }) })
        await expect(new ClearCartResolver(commandBus).clearCart(principal)).resolves.toEqual({ cleared: true })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new ClearCartCommand({ request: {}, principal }))
    })
})
