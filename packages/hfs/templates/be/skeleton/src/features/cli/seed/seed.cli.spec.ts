import { Test } from "@nestjs/testing"
import { SeedCli } from "./seed.cli"

describe("SeedCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [SeedCli],
        }).compile()
        const group = moduleRef.get(SeedCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await Promise.resolve(group.run())

        expect(help).toHaveBeenCalledTimes(1)
    })
})
