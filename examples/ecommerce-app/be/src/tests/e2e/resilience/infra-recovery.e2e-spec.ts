import { readCount } from "../../fixtures/persistence/e2e-verification.rows"
import { PRODUCT_COUNT } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * Infra-down recovery, on the world's own operations. Each dependency is taken down mid-run and put back: the apis must stay
 * alive and answer /health with a clean 503 instead of hanging or crashing, then recover to 200, with the persisted world
 * intact and the public doors working again.
 *  - the cache (the real Redis, `world.infra.redis` cut and restored): identity reports its cache unreachable and order cascades through the
 *    identity health it probes;
 *  - the order database (`world.infra.postgresql.connection("order")`): order reports its database unreachable, identity stays healthy;
 *  - the identity database: identity reports 503 and so does order, whose probe of identity fails.
 */
describe("resilience: infra recovery", () => {
    const world = useTestWorld({
        apps: ["identity", "order"],
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
        try {
            await answers("identity", 503, 90_000)
            await answers("order", 503, 90_000)
        } finally {
            await world.infra.redis.restore()
        }

        await answers("identity", 200, 180_000)
        await answers("order", 200, 180_000)
        expect(await productsSeeded()).toBe(seeded)
    })

    it("an order database outage takes order down, not identity, and order recovers with the database", async () => {
        const seeded = await productsSeeded()

        await world.infra.postgresql.connection("order").during(async () => {
            await answers("order", 503, 90_000)
            expect(await status("identity")).toBe(200)
        })

        await answers("order", 200, 180_000)
        expect(await productsSeeded()).toBe(seeded)
        const person = await world.signedInPerson("recovery")
        const cart = await world.apps.order.api.bearing(person.sessionToken).read("cart")
        expect(cart.errorCode).toBeNull()
    })

    it("an identity database outage takes identity and, through its probe, order down; both recover", async () => {
        await world.infra.postgresql.connection("identity").during(async () => {
            await answers("identity", 503, 90_000)
            await answers("order", 503, 90_000)
        })

        await answers("identity", 200, 180_000)
        await answers("order", 200, 180_000)
        const person = await world.signedInPerson("recovery-identity")
        expect(person.sessionToken).not.toBe("")
    })
})
