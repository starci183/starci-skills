import { mock } from "@starci/jest-preset/mock"
import type { EntityManager } from "typeorm"
import { PING } from "./database.sql"
import { DatabaseProbe } from "./database-probe.service"

describe("DatabaseProbe", () => {
    it("pings the connection with the SELECT 1 constant", async () => {
        const manager = mock<EntityManager>({ query: jest.fn().mockResolvedValue([]) })
        await new DatabaseProbe(manager).check()
        expect(manager.query).toHaveBeenCalledWith(PING, [])
    })

    it("rejects with the driver failure when the connection does not answer", async () => {
        const dead = mock<EntityManager>({ query: jest.fn().mockRejectedValue(new TypeError("connection refused")) })
        await expect(new DatabaseProbe(dead).check()).rejects.toThrow("connection refused")
    })
})
