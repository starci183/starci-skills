import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { SeedRunnerService } from "@modules/platform/database"
import { RunSeedsCli } from "./run.cli"

const build = async (seeds: SeedRunnerService) => {
    const moduleRef = await Test.createTestingModule({
        providers: [RunSeedsCli, { provide: SeedRunnerService, useValue: seeds }],
    }).compile()
    return moduleRef.get(RunSeedsCli)
}

describe("RunSeedsCli", () => {
    it("delegates the seed run of the named environment to the seed runner once", async () => {
        const seeds = mock<SeedRunnerService>()
        const command = await build(seeds)

        await command.run([], { env: "staging" })

        expect(seeds.run).toHaveBeenCalledWith("staging")
        expect(seeds.run).toHaveBeenCalledTimes(1)
    })

    it("delegates with no environment when none is named, and takes --env as given", async () => {
        const seeds = mock<SeedRunnerService>()
        const command = await build(seeds)

        await command.run([])

        expect(seeds.run).toHaveBeenCalledWith(undefined)
        expect(command.parseEnv("staging")).toBe("staging")
    })
})
