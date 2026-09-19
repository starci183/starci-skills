/**
 * Lane E2E-09 -- infra-down recovery (ecommerce-app-be).
 *
 * Boots the run-scoped stack through the shared world helper, kills the redis container mid-run,
 * asserts both apis stay alive and answer /health with a clean 503 (identity reports
 * checks.redis unreachable; order cascades through identity's health), starts the same container
 * back, and asserts every api door recovers to 200 - with the persisted world proven intact
 * before and after the outage. Skips with a reason when no docker daemon answers.
 */
import {
    stderr 
} from "node:process"
import {
    bootE2eWorld 
} from "@tests/infra/e2e-world"
import {
    dockerAvailable,
    httpStatus,
    killService,
    retryUntil,
    startContainer,
} from "./e2e-infra-contract"

const runnable = dockerAvailable()
if (!runnable) {
    stderr.write("[e2e-09] infra-recovery skipped: docker daemon not reachable\n")
}
const describeE2E = runnable ? describe : describe.skip

describeE2E("resilience: infra recovery",
    () => {
        jest.setTimeout(600_000)

        it("redis outage yields clean api errors and both apis recover when redis returns",
            async () => {
                const { moduleRef, stack, dataSource } = await bootE2eWorld("resilience/infra-recovery")
                try {
                    const project = stack.project

                    // The persisted world is real before the outage: postgres answers out-of-band.
                    const seeded = await dataSource.query<{ count: number }>(
                        "SELECT COUNT(*)::int AS count FROM product")
                    expect(seeded[0].count).toBeGreaterThan(0)

                    const apis = [
                        stack.endpoint("identity").baseUrl,
                        stack.endpoint("order").baseUrl,
                    ]

                    const killed = killService(project,
                        /redis/i)

                    // Both apis tolerate the outage: still answering HTTP with a declared dependency error.
                    for (const base of apis) {
                        await retryUntil(`${base}/health answers 503`,
                            90_000,
                            async () => (await httpStatus(`${base}/health`,
                                15_000)) === 503)
                    }

                    startContainer(killed.id)

                    for (const base of apis) {
                        await retryUntil(`${base}/health recovers to 200`,
                            180_000,
                            async () => (await httpStatus(`${base}/health`)) === 200)
                    }

                    // Postgres kept the persisted world through the whole redis outage.
                    const after = await dataSource.query<{ count: number }>(
                        "SELECT COUNT(*)::int AS count FROM product")
                    expect(after).toEqual(seeded)
                } finally {
                    await moduleRef.close().catch(() => undefined)
                }
            })
    })
