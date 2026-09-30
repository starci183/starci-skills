/**
 * Infra-down recovery. Boots the run-scoped stack, kills the redis container mid-run, asserts both apis stay alive and
 * answer /health with a clean 503 (identity reports its cache unreachable; order cascades through identity health),
 * starts the same container back, and asserts every api door recovers to 200, with the persisted world proven intact
 * before and after the outage. Skips with a reason when no docker daemon answers.
 */
import { retryUntil } from "@e2e-kit/platform/readiness"
import { dockerProbe, killService, startContainer } from "../setup/docker.client"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EServiceName } from "../setup/e2e-stack.service"

const probe = dockerProbe()
const describeE2E = probe.available ? describe : describe.skip

const services: ReadonlyArray<E2EServiceName> = ["identity", "order"]

describeE2E("resilience: infra recovery", () => {
    jest.setTimeout(600_000)

    it("a redis outage yields clean api errors and both apis recover when redis returns", async () => {
        const world = await bootE2eWorld("resilience/infra-recovery")
        try {
            // The persisted world is real before the outage: postgres answers out-of-band.
            const seeded = await world.database.productCount()
            expect(seeded).toBeGreaterThan(0)

            const killed = killService(world.stack.project, "redis")

            // Both apis tolerate the outage: still answering HTTP with a declared dependency error.
            for (const service of services) {
                await retryUntil(`${service} /health answers 503`, 90_000, async () => (await world.http(service).get("/health")).status === 503)
            }

            startContainer(killed)

            for (const service of services) {
                await retryUntil(`${service} /health recovers to 200`, 180_000, async () => (await world.http(service).get("/health")).status === 200)
            }

            // Postgres kept the persisted world through the whole redis outage.
            expect(await world.database.productCount()).toEqual(seeded)
            expect(await world.database.ping()).toBe(true)
        } finally {
            await world.close()
        }
    })
})
