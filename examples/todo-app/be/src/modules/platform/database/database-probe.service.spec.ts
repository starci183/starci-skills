import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PING } from "./database.sql"
import { DatabaseProbe } from "./database-probe.service"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"

const build = async (manager: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DatabaseProbe, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return moduleRef.get(DatabaseProbe)
}

describe("DatabaseProbe", () => {
    it("is listed under the database name", async () => {
        const probe = await build(mockEntityManager())

        expect(probe.name).toBe("database")
    })

    describe("check", () => {
        it("resolves when the primary connection answers the ping", async () => {
            const manager = mockEntityManager({ query: [PING, [{ ok: 1 }]] })
            const probe = await build(manager)

            await expect(probe.check()).resolves.toBeUndefined()
            expect(manager.query).toHaveBeenCalledWith(PING, [])
        })

        it("rejects with the driver failure when the connection does not answer", async () => {
            const manager = mockEntityManager()
            manager.query.mockRejectedValue(new Error("connection refused"))
            const probe = await build(manager)

            await expect(probe.check()).rejects.toThrow("connection refused")
        })
    })
})
