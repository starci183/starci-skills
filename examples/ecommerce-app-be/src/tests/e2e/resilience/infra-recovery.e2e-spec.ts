import { AppModule as IdentityApp } from "../../../../apps/identity/src/app.module"
import { AppModule as OrderApp } from "../../../../apps/order/src/app.module"
import { readCount } from "../../fixtures/persistence/e2e-verification.rows"
import { PRODUCT_COUNT } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * Infra-down recovery on the REAL services of the stack, failed through their toxiproxy proxies. Each dependency is cut mid-run
 * (`world.infra.<service>.cut()`) and restored (`.restore()`): the apis must stay alive and answer /health with a clean 503
 * instead of hanging or crashing, then recover to 200, with the persisted world intact and the public doors working again.
 *  - the cache (`world.infra.redis`): identity reports its cache unreachable and order cascades through the identity health it
 *    probes;
 *  - the database (`world.infra.postgres`): the identity and the order database are two databases of the one Postgres the stack
 *    declares, so identity reports 503 and so does order, whose own database and whose probe of identity both fail.
 */
describe("resilience: infra recovery", () => {
    const world = useTestWorld({
        apps: { identity: { module: IdentityApp }, order: { module: OrderApp } },
        testTimeoutMs: 900_000,
    })

    const status = async (app: "identity" | "order"): Promise<number> =>
        (await world.apps[app].api.get("/health")).status

    const answers = (app: "identity" | "order", expected: number, timeoutMs: number): Promise<boolean> =>
        world.waitFor(
            `${app} /health answers ${expected}`,
            async () => ((await status(app)) === expected ? true : null),
            { timeoutMs, intervalMs: 1000 },
        )

    const productsSeeded = (): Promise<number> => readCount(world.db.order, PRODUCT_COUNT)

    it("a cache outage yields clean api errors and both apis recover when the cache returns", async () => {
        const seeded = await productsSeeded()
        expect(seeded).toBeGreaterThan(0)
        expect(await status("identity")).toBe(200)
        expect(await status("order")).toBe(200)

        await world.infra.redis.cut()
        await answers("identity", 503, 90_000)
        await answers("order", 503, 90_000)
        await world.infra.redis.restore()

        await answers("identity", 200, 180_000)
        await answers("order", 200, 180_000)
        expect(await productsSeeded()).toBe(seeded)
    })

    it("a database outage takes identity and, through its probe, order down; both recover", async () => {
        const seeded = await productsSeeded()

        await world.infra.postgres.cut()
        await answers("identity", 503, 90_000)
        await answers("order", 503, 90_000)
        await world.infra.postgres.restore()

        await answers("identity", 200, 180_000)
        await answers("order", 200, 180_000)
        expect(await productsSeeded()).toBe(seeded)
        const person = await world.signedInPerson("recovery")
        expect(person.sessionToken).not.toBe("")
        const cart = await world.apps.order.api.bearing(person.sessionToken).read("cart")
        expect(cart.errorCode).toBeNull()
    })
})
