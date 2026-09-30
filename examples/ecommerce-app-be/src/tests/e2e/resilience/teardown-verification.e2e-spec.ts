import { AppModule as IdentityApp } from "../../../../apps/identity/src/app.module"
import { AppModule as OrderApp } from "../../../../apps/order/src/app.module"
import { readCount } from "../../fixtures/persistence/e2e-verification.rows"
import { PRODUCT_COUNT } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * Teardown contract of the world. The persisted world is real before the close; closing the world (the path every spec
 * `afterAll` takes) releases every listener it opened: the apps stop answering.
 * The containers of the run are removed and verified by the jest globalTeardown, which fails the run when one survives.
 */
describe("resilience: teardown verification", () => {
    const world = useTestWorld({ apps: { identity: { module: IdentityApp }, order: { module: OrderApp } } })

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
