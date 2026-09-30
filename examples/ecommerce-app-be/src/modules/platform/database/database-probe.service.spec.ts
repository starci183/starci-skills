import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DATABASE_MANAGERS } from "./database.decorators"
import { PING } from "./database.sql"
import { DatabaseProbeService } from "./database-probe.service"

describe("DatabaseProbeService", () => {
    const build = async (managers: ReadonlyArray<ReturnType<typeof mockEntityManager>>) => {
        const moduleRef = await Test.createTestingModule({
            providers: [DatabaseProbeService, { provide: DATABASE_MANAGERS, useValue: managers }],
        }).compile()
        return moduleRef.get(DatabaseProbeService)
    }

    it("is named database", async () => {
        expect((await build([])).name).toBe("database")
    })

    it("pings every connection and resolves when all answer", async () => {
        const identity = mockEntityManager({ query: [PING, [{ "?column?": 1 }]] })
        const order = mockEntityManager({ query: [PING, [{ "?column?": 1 }]] })

        await expect((await build([identity, order])).check()).resolves.toBeUndefined()

        expect(identity.query).toHaveBeenCalledWith(PING, [])
        expect(order.query).toHaveBeenCalledWith(PING, [])
    })

    it("rejects with the driver failure and stops at the connection that does not answer", async () => {
        const identity = mockEntityManager({ query: [PING, []] })
        identity.query.mockRejectedValue(new Error("connection refused"))
        const order = mockEntityManager()

        await expect((await build([identity, order])).check()).rejects.toThrow("connection refused")

        expect(order.query).not.toHaveBeenCalled()
    })

    it("resolves when the app opened no connection", async () => {
        await expect((await build([])).check()).resolves.toBeUndefined()
    })
})
