import { randomUUID } from "node:crypto"
import {
    CREATE_PROBE_FACT,
    CREATE_PROBE_TOTAL,
    ProbeTotalProjection,
} from "../../fixtures/projections/probe-total.projection"
import { useTestWorld } from "../../world/use-test-world"

/**
 * projection: a read model recomputed from the facts of its own context in the order database. A recompute is an upsert by the
 * natural key, so repeating it changes nothing; the table can be dropped and rebuilt from the facts alone. The two scenarios are
 * the proof of the declared `projection` pattern.
 */
describe("projection (integration)", () => {
    const world = useTestWorld({ modules: [] })

    const projection = (): ProbeTotalProjection => new ProbeTotalProjection(world.db.order)
    const addFact = (owner: string, amount: number): Promise<unknown> =>
        world.db.order.query("INSERT INTO probe_fact (owner, amount) VALUES ($1, $2)", [owner, amount])

    beforeAll(async () => {
        await world.db.order.query(CREATE_PROBE_FACT)
        await world.db.order.query(CREATE_PROBE_TOTAL)
    })

    it("projection/recompute-is-idempotent: recomputing twice leaves one row with the same total, and a new fact moves it", async () => {
        const owner = `idem-${randomUUID()}`
        await addFact(owner, 30)
        await addFact(owner, 12)

        await projection().recomputeProbeTotal(owner)
        await projection().recomputeProbeTotal(owner)

        expect(await projection().getProbeTotal(owner)).toBe(42)
        expect(await world.db.order.query("SELECT 1 FROM probe_total WHERE owner = $1", [owner])).toHaveLength(1)
        await addFact(owner, 8)
        await projection().recomputeProbeTotal(owner)
        expect(await projection().getProbeTotal(owner)).toBe(50)
        expect(await projection().getProbeTotal(`none-${randomUUID()}`)).toBeNull()
    })

    it("projection/replay-rebuilds: dropping the read model and replaying from the facts restores the same rows", async () => {
        const owners = [`replay-a-${randomUUID()}`, `replay-b-${randomUUID()}`]
        await addFact(owners[0] ?? "", 5)
        await addFact(owners[0] ?? "", 6)
        await addFact(owners[1] ?? "", 7)
        for (const owner of owners) await projection().recomputeProbeTotal(owner)
        const before = await Promise.all(owners.map((owner) => projection().getProbeTotal(owner)))

        await world.db.order.query("DELETE FROM probe_total")
        expect(await projection().getProbeTotal(owners[0] ?? "")).toBeNull()
        await projection().replayProbeTotals()

        expect(await Promise.all(owners.map((owner) => projection().getProbeTotal(owner)))).toEqual(before)
        expect(before).toEqual([11, 7])
    })
})
