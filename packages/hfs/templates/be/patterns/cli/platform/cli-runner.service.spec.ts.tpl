import { CliRunnerService } from "./cli-runner.service"
import type { CliCommand } from "./cli.contracts"

const command = (name: string, exitCode: number): CliCommand & { readonly seen: Array<ReadonlyArray<string>> } => {
    const seen: Array<ReadonlyArray<string>> = []
    return {
        name,
        seen,
        run: (args) => {
            seen.push(args)
            return Promise.resolve(exitCode)
        },
    }
}

describe("CliRunnerService", () => {
    describe("run", () => {
        it("runs the named command with the arguments after its name and answers its exit code", async () => {
            const runner = new CliRunnerService()
            const requeue = command("requeue", 0)
            runner.add(requeue)

            await expect(runner.run(["requeue", "id-1", "--force"])).resolves.toBe(0)

            expect(requeue.seen).toEqual([["id-1", "--force"]])
        })

        it("answers the exit code of a failing command", async () => {
            const runner = new CliRunnerService()
            runner.add(command("rebuild", 1))

            await expect(runner.run(["rebuild"])).resolves.toBe(1)
        })

        it("answers 2 for an unknown or a missing command name and runs nothing", async () => {
            const runner = new CliRunnerService()
            const requeue = command("requeue", 0)
            runner.add(requeue)

            await expect(runner.run(["rebuild"])).resolves.toBe(2)
            await expect(runner.run([])).resolves.toBe(2)

            expect(requeue.seen).toEqual([])
        })

        it("keeps the last command registered under a name", async () => {
            const runner = new CliRunnerService()
            runner.add(command("requeue", 0))
            runner.add(command("requeue", 3))

            await expect(runner.run(["requeue"])).resolves.toBe(3)
        })
    })
})
