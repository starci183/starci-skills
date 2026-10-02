import { Test } from "@nestjs/testing"
import { @@Group@@Cli } from "./@@group@@.cli"

describe("@@Group@@Cli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [@@Group@@Cli] }).compile()
        const group = moduleRef.get(@@Group@@Cli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(group.run()).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
