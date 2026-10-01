import { readCount } from "../../fixtures/persistence/e2e-verification.rows"
import { PRODUCT_COUNT } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * Teardown contract of the world. The persisted world is real before the close; closing the world (the path every spec
 * `afterAll` takes) releases every listener it opened: the apps stop answering.
 * What the run provisioned (its databases and run directory) is dropped by the library globalTeardown; the shared containers stay warm.
 */
describe("resilience: teardown verification", () => {
    const world = useTestWorld({ apps: ["identity", "order"] })

    it("closing the world leaves no app or provider listening", async () => {
        expect(await readCount(world.db.order, PRODUCT_COUNT)).toBeGreaterThan(0)
        const { identity, order } = world.apps
        expect((await identity.api.get("/health")).status).toBe(200)
        expect((await order.api.get("/health")).status).toBe(200)

        await world.stop()

        await expect(identity.api.get("/health")).rejects.toBeDefined()
        await expect(order.api.get("/health")).rejects.toBeDefined()
    })
})
