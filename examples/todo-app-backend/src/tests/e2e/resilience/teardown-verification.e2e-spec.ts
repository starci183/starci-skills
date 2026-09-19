/**
 * Lane E2E-09 -- teardown contract verification (todo-app-backend).
 *
 * Boots the run-scoped stack through the shared world, records the exact containers and volumes
 * this run created, closes the module (the same path every spec's afterAll takes), then proves by
 * direct docker observation that none of them remain -- the contract E2EStackService implements in
 * onApplicationShutdown (`down -v` + cleanup verification). A live DataSource read before the close
 * proves the data tier really stood up; the stack's own teardownReport must agree with the daemon's
 * verdict. Skips with a reason while the docker daemon is not reachable.
 */
import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    composeProjectOf,
    dockerAvailable,
    dockerLines,
} from "./e2e-infra-contract"

const runnable = dockerAvailable()
if (!runnable) {
    process.stderr.write("[e2e-09] teardown-verification skipped: docker daemon not reachable\n")
}
const describeE2E = runnable ? describe : describe.skip

/**
 * Closes the world unless the step already closed it - the teardown path is the thing under test,
 * so double-closing on failure would mask which close actually ran.
 */
async function ensureWorldClosed(world: E2EWorld, alreadyClosed: boolean): Promise<void> {
    if (!alreadyClosed) await world.moduleRef.close().catch(() => undefined)
}

/** The stack's own teardown self-report must agree with the daemon-level observation. */
function expectTeardownReportClean(world: E2EWorld): void {
    const report = world.stack.teardownReport
    if (report !== null) {
        expect(report.clean).toBe(true)
    }
}

describeE2E("resilience: teardown verification",
    () => {
        jest.setTimeout(600_000) // first-boot images + keycloak realm import can take minutes

        it("closing the module removes every container and volume the run created",
            async () => {
                const world = await bootE2EWorld("resilience/teardown-verification")
                let closed = false
                try {
                    const {
                        stack, dataSource 
                    } = world
                    const project = composeProjectOf(stack)
                    expect(project).not.toBeNull() // stack must expose its run-scoped compose project name

                    // Baseline: the stack really did stand a live data tier up before teardown is asked to
                    // remove it - the DataSource answers a real query against this run's postgres.
                    const baseline = await dataSource.query<Array<{ ok: number }>>("select 1 as ok")
                    expect(baseline[0].ok).toBe(1)

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

                    await world.moduleRef.close()
                    closed = true

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

                    expectTeardownReportClean(world)
                } finally {
                    await ensureWorldClosed(world,
                        closed)
                }
            })
    })
