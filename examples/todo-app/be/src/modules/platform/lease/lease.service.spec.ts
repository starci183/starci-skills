import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PLATFORM_AT } from "@tests/fixtures/builders/platform.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PostgresLease } from "./lease.service"
import { ACQUIRE_LEASE, RELEASE_LEASE } from "./persistence/lease.sql"

const AT = new Date(PLATFORM_AT)

const build = async (manager: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [PostgresLease, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return moduleRef.get(PostgresLease)
}

describe("PostgresLease", () => {
    describe("acquire", () => {
        it("grants the lease with the fence the store returns as a number", async () => {
            const manager = mockEntityManager({ query: [ACQUIRE_LEASE, [{ fence: "7" }]] })
            const lease = await build(manager)

            await expect(lease.acquire({ name: "digest", holder: "h-1", ttlMs: 60_000, at: AT })).resolves.toEqual({
                name: "digest",
                holder: "h-1",
                fence: 7,
            })
            expect(manager.query).toHaveBeenCalledWith(ACQUIRE_LEASE, [
                "digest",
                "h-1",
                new Date("2026-05-01T10:01:00.000Z"),
                AT,
            ])
        })

        it("answers null when another holder owns the lease", async () => {
            const lease = await build(mockEntityManager({ query: [ACQUIRE_LEASE, []] }))

            await expect(lease.acquire({ name: "digest", holder: "h-2", ttlMs: 60_000, at: AT })).resolves.toBeNull()
        })
    })

    describe("release", () => {
        it("releases the grant by name, fence and holder", async () => {
            const manager = mockEntityManager({ query: [RELEASE_LEASE, []] })
            const lease = await build(manager)

            await lease.release({ grant: { name: "digest", holder: "h-1", fence: 7 } })

            expect(manager.query).toHaveBeenCalledWith(RELEASE_LEASE, ["digest", 7, "h-1"])
        })
    })
})
