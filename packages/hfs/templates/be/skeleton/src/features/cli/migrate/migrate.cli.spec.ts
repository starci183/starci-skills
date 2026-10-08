import { Test } from "@nestjs/testing"
import { MigrateCli } from "./migrate.cli"

describe("MigrateCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [MigrateCli],
        }).compile()
        const group = moduleRef.get(MigrateCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
