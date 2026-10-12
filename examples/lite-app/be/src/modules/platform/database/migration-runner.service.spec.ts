import childProcess, { ChildProcess } from "node:child_process"
import { Test } from "@nestjs/testing"
import { MigrationRunnerService } from "./migration-runner.service"

const PLATFORM = Object.getOwnPropertyDescriptor(process, "platform")

/** Runs the service on `platform` with a child process double; returns the running promise and the double. */
const start = async (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true })
    const child = new ChildProcess()
    const spawn = jest.spyOn(childProcess, "spawn").mockReturnValue(child)
    const moduleRef = await Test.createTestingModule({ providers: [MigrationRunnerService] }).compile()
    const running = moduleRef.get(MigrationRunnerService).run()
    return { running, child, spawn }
}

describe("MigrationRunnerService", () => {
    afterEach(() => {
        jest.restoreAllMocks()
        if (PLATFORM !== undefined) Object.defineProperty(process, "platform", PLATFORM)
    })

    it("runs the managed db:push wrapper through npm and resolves when it exits cleanly", async () => {
        const { running, child, spawn } = await start("linux")

        child.emit("exit", 0)

        await expect(running).resolves.toBeUndefined()
        expect(spawn).toHaveBeenCalledWith("npm", ["run", "db:push"], { stdio: "inherit" })
    })

    it("runs npm.cmd on Windows", async () => {
        const { running, child, spawn } = await start("win32")

        child.emit("exit", 0)

        await expect(running).resolves.toBeUndefined()
        expect(spawn).toHaveBeenCalledWith("npm.cmd", ["run", "db:push"], { stdio: "inherit" })
    })

    it("fails with the exit status of a wrapper that exits non-zero", async () => {
        const { running, child } = await start("linux")

        child.emit("exit", 1)

        await expect(running).rejects.toThrow("db:push exited 1")
    })

    it("fails when the wrapper ends without an exit status", async () => {
        const { running, child } = await start("linux")

        child.emit("exit", null)

        await expect(running).rejects.toThrow("db:push exited without a status")
    })

    it("fails when the wrapper cannot be started", async () => {
        const { running, child } = await start("linux")
        const failure = new Error("spawn npm ENOENT")

        child.emit("error", failure)

        await expect(running).rejects.toBe(failure)
    })
})
