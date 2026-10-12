import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { SeedRunnerService } from "@modules/platform/database"
import { RunSeedsCli } from "./run.cli"

describe("RunSeedsCli", () => {
    it("delegates the seed run to the seed runner once", async () => {
        const seeds = mock<SeedRunnerService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RunSeedsCli, { provide: SeedRunnerService, useValue: seeds }],
        }).compile()

        await expect(moduleRef.get(RunSeedsCli).run()).resolves.toBeUndefined()

        expect(seeds.run).toHaveBeenCalledTimes(1)
    })
})
