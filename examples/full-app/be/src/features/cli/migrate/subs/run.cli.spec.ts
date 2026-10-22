import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { MigrationRunnerService } from "@modules/platform/database"
import { RunCli } from "./run.cli"

describe("RunCli", () => {
    it("delegates the migration run to the migration runner once", async () => {
        const migrations = mock<MigrationRunnerService>()
        const moduleRef = await Test.createTestingModule({
            providers: [RunCli, { provide: MigrationRunnerService, useValue: migrations }],
        }).compile()

        await expect(moduleRef.get(RunCli).run()).resolves.toBeUndefined()

        expect(migrations.run).toHaveBeenCalledTimes(1)
    })
})
