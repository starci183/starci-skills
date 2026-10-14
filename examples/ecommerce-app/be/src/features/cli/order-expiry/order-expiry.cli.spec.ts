import { Test } from "@nestjs/testing"
import { OrderExpiryCli } from "./order-expiry.cli"

describe("OrderExpiryCli", () => {
    it("shows the group help when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [OrderExpiryCli] }).compile()
        const group = moduleRef.get(OrderExpiryCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
