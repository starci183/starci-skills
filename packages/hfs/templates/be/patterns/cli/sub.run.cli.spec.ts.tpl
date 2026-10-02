import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { @@service@@ } from "@@serviceModule@@"
import { RunCli } from "./run.cli"

describe("RunCli", () => {
    it("delegates the @@group@@ run to the runner service once", async () => {
        const @@serviceCamel@@ = mock<@@service@@>()
        const moduleRef = await Test.createTestingModule({
            providers: [RunCli, { provide: @@service@@, useValue: @@serviceCamel@@ }],
        }).compile()

        await expect(moduleRef.get(RunCli).run()).resolves.toBeUndefined()

        expect(@@serviceCamel@@.run).toHaveBeenCalledTimes(1)
    })
})
