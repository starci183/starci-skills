import { mockEntityManager } from "@tests/fixtures/database"
import { PostgresLeaseService } from "./lease.service"
import { ACQUIRE_LEASE, RELEASE_LEASE } from "./persistence/lease.sql"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("PostgresLeaseService", () => {
    it("grants the lease with the fence the upsert answers", async () => {
        const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ fence: "3" }]) })
        const grant = await new PostgresLeaseService(manager).acquire({ name: "job", holder: "a", ttlMs: 60_000, at: AT })
        expect(grant).toEqual({ name: "job", holder: "a", fence: 3 })
        expect(manager.query).toHaveBeenCalledWith(ACQUIRE_LEASE, [
            "job",
            "a",
            new Date("2026-09-30T10:01:00.000Z"),
            AT,
        ])
    })

    it("answers null when another live holder has the lease", async () => {
        const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        await expect(new PostgresLeaseService(manager).acquire({ name: "job", holder: "b", ttlMs: 1, at: AT })).resolves.toBeNull()
    })

    it("releases by name, fence and holder", async () => {
        const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        await new PostgresLeaseService(manager).release({ grant: { name: "job", holder: "a", fence: 3 } })
        expect(manager.query).toHaveBeenCalledWith(RELEASE_LEASE, ["job", 3, "a"])
    })
})
