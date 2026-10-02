// Imports the host resolves:
//   import { useTestWorld } from "../../world/use-test-world"

describe("requeue-dead-letter (e2e)", () => {
    const world = useTestWorld({ apps: ["tools"] })

    it("requeues a buried event once and refuses a second run", async () => {
        const letter = await world.buryEvent()
        const first = await world.runCli("requeue-dead-letter", [letter.id])
        const second = await world.runCli("requeue-dead-letter", [letter.id])
        expect(first.exitCode).toBe(0)
        expect(second.exitCode).not.toBe(0)
    })

    it("exits non-zero with the error code for a bad argument", async () => {
        const run = await world.runCli("requeue-dead-letter", ["not-an-id"])
        expect(run.exitCode).not.toBe(0)
        expect(run.stderr).toContain("DEAD_LETTER_NOT_FOUND")
    })
})
