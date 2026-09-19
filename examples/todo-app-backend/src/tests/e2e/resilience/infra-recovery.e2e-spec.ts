/**
 * Lane E2E-09 -- infra-down recovery (todo-app-backend).
 *
 * Boots the run-scoped stack, kills the postgres container mid-run (the one dependency the api's
 * /health door probes), asserts the api stays alive and answers with a clean 503 instead of hanging
 * or crashing, starts the same container back (identical ports/volume), and asserts the api recovers
 * to 200. The out-of-band DataSource read at the end proves the data tier itself answers queries
 * again, alongside the api door's own dependency probe turning green. Skips with a reason while the
 * docker daemon is not reachable.
 */
import {
    bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    apiHealthUrls,
    composeProjectOf,
    dockerAvailable,
    httpStatus,
    killService,
    retryUntil,
    startContainer,
} from "./e2e-infra-contract"

const runnable = dockerAvailable()
if (!runnable) {
    process.stderr.write("[e2e-09] infra-recovery skipped: docker daemon not reachable\n")
}
const describeE2E = runnable ? describe : describe.skip

describeE2E("resilience: infra recovery",
    () => {
        jest.setTimeout(600_000)

        it("postgres outage yields a clean api error and the api recovers when postgres returns",
            async () => {
                const world = await bootE2EWorld("resilience/infra-recovery")
                try {
                    const {
                        stack, dataSource 
                    } = world
                    const project = composeProjectOf(stack)
                    expect(project).not.toBeNull()

                    const apis = await apiHealthUrls(stack)
                    expect(apis.length).toBeGreaterThan(0)

                    // Baseline: the out-of-band data channel answers before the chaos begins.
                    const baseline = await dataSource.query<Array<{ ok: number }>>("select 1 as ok")
                    expect(baseline[0].ok).toBe(1)

                    const killed = killService(project!,
                        /postgres/i)

                    // The api tolerates the outage: still answering HTTP, with a declared dependency error.
                    for (const base of apis) {
                        await retryUntil(`${base}/health answers 503`,
                            60_000,
                            async () => (await httpStatus(`${base}/health`,
                                15_000)) === 503)
                    }

                    startContainer(killed.id)

                    for (const base of apis) {
                        await retryUntil(`${base}/health recovers to 200`,
                            180_000,
                            async () => (await httpStatus(`${base}/health`)) === 200)
                    }

                    // Persisted-state evidence: postgres itself answers real queries again - the api's 200
                    // proves its pool reconnected, this proves the data tier's own surface is back.
                    const recovered = await dataSource.query<Array<{ ok: number }>>("select 1 as ok")
                    expect(recovered[0].ok).toBe(1)
                } finally {
                    await world.moduleRef.close().catch(() => undefined)
                }
            })
    })
