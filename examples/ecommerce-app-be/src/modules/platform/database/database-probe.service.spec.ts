import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { DATABASE_MANAGERS } from "./database-probe.tokens"
import { PING } from "./database.sql"
import { DatabaseProbeService } from "./database-probe.service"

const build = async () => {
    const identity = mockEntityManager()
    const order = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [DatabaseProbeService, { provide: DATABASE_MANAGERS, useValue: [identity, order] }],
    }).compile()
    return { probe: moduleRef.get(DatabaseProbeService), identity, order }
}

describe("DatabaseProbeService", () => {
    it("is named database", async () => {
        const { probe } = await build()

        expect(probe.name).toBe("database")
    })

    it("pings every connection and resolves when all answer", async () => {
        const { probe, identity, order } = await build()
        identity.query.mockResolvedValue([{ "?column?": 1 }])
        order.query.mockResolvedValue([{ "?column?": 1 }])

        await expect(probe.check()).resolves.toBeUndefined()

        expect(identity.query).toHaveBeenCalledWith(PING, [])
        expect(order.query).toHaveBeenCalledWith(PING, [])
    })

    it("rejects with the driver failure and stops at the connection that does not answer", async () => {
        const { probe, identity, order } = await build()
        identity.query.mockRejectedValue(new Error("connection refused"))

        await expect(probe.check()).rejects.toThrow("connection refused")

        expect(order.query).not.toHaveBeenCalled()
    })
})
