import { Test } from "@nestjs/testing"
import { MigrateCli } from "./migrate.cli"

describe("MigrateCli", () => {
    it("shows the help of the group when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [MigrateCli] }).compile()
        const group = moduleRef.get(MigrateCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await group.run()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
