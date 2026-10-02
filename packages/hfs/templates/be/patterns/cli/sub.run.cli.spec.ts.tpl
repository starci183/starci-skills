import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { @@service@@ } from "@@serviceModule@@"
import { RunCli } from "./run.cli"

describe("RunCli", () => {
    it("runs @@group@@ through the domain service, once", async () => {
        const @@serviceCamel@@ = mock<@@service@@>()
        const moduleRef = await Test.createTestingModule({
            providers: [RunCli, { provide: @@service@@, useValue: @@serviceCamel@@ }],
        }).compile()

        await moduleRef.get(RunCli).run()

        expect(@@serviceCamel@@.@@groupCamel@@).toHaveBeenCalledTimes(1)
    })
})
