/**
 * Lane E2E-09 -- teardown contract verification (ecommerce-app-be).
 *
 * Boots the run-scoped stack through the shared world helper, records the exact containers and
 * volumes this run created, closes the module (the same path every spec's afterAll takes), then
 * proves by direct docker observation that none of them remain -- the contract E2EStackService
 * implements in onApplicationShutdown (`down -v` + cleanup verification). Skips with a reason
 * when no docker daemon answers.
 */
import {
    stderr 
} from "node:process"
import {
    bootE2eWorld 
} from "@tests/infra/e2e-world"
import {
    dockerAvailable,
    dockerLines,
} from "./e2e-infra-contract"

const runnable = dockerAvailable()
if (!runnable) {
    stderr.write("[e2e-09] teardown-verification skipped: docker daemon not reachable\n")
}
const describeE2E = runnable ? describe : describe.skip

describeE2E("resilience: teardown verification",
    () => {
        jest.setTimeout(600_000) // first-boot images + two api processes can take minutes

        it("closing the module removes every container and volume the run created",
            async () => {
                const { moduleRef, stack, dataSource } = await bootE2eWorld("resilience/teardown-verification")
                try {
                    const project = stack.project

                    // The persisted world is real before teardown: postgres answers out-of-band, and
                    // this run owns the containers and volumes the assertions below prove are gone.
                    const seeded = await dataSource.query<{ count: number }>(
                        "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'")
                    expect(seeded[0].count).toBeGreaterThan(0)

                    const containers = dockerLines([
                        "ps",
                        "-a",
                        "--filter",
                        `label=com.docker.compose.project=${project}`,
                        "--format",
                        "{{.Names}}",
                    ])
                    const volumes = dockerLines([
                        "volume",
                        "ls",
                        "--filter",
                        `name=${project}`,
                        "--format",
                        "{{.Name}}",
                    ])
                    expect(containers.length).toBeGreaterThan(0)

                    await moduleRef.close()

                    // The contract: after module close, nothing of this run's project survives on the daemon.
                    expect(
                        dockerLines(["ps",
                            "-a",
                            "--filter",
                            `label=com.docker.compose.project=${project}`,
                            "--format",
                            "{{.Names}}"]),
                    ).toEqual([])
                    expect(
                        dockerLines(["volume",
                            "ls",
                            "--filter",
                            `name=${project}`,
                            "--format",
                            "{{.Name}}"]),
                    ).toEqual([])

                    for (const name of containers) {
                        expect(() => dockerLines(["container",
                            "inspect",
                            name])).toThrow()
                    }
                    for (const name of volumes) {
                        expect(() => dockerLines(["volume",
                            "inspect",
                            name])).toThrow()
                    }

                    // The stack's own teardown self-report must agree with the docker observation.
                    expect(stack.cleanupReport?.clean).toBe(true)
                } finally {
                    await moduleRef.close().catch(() => undefined)
                }
            })
    })
