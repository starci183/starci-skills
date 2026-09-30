import { FakeClock } from "@starci/jest-preset/clock"
import { mockEntityManager } from "@tests/fixtures/database"
import { PostgresInboxService } from "./inbox.service"
import { CLAIM_EVENT, RELEASE_EVENT } from "./persistence/inbox.sql"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("PostgresInboxService", () => {
    it("answers true when the insert wins", async () => {
        const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ event_id: "e1" }]) })
        await expect(new PostgresInboxService(manager, new FakeClock(AT)).claim("audit.append", "e1")).resolves.toBe(true)
        expect(manager.query).toHaveBeenCalledWith(CLAIM_EVENT, ["audit.append", "e1", AT])
    })

    it("answers false when the event was claimed before", async () => {
        const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        await expect(new PostgresInboxService(manager, new FakeClock(AT)).claim("audit.append", "e1")).resolves.toBe(false)
    })

    it("deletes the claim on release", async () => {
        const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        await new PostgresInboxService(manager, new FakeClock(AT)).release("audit.append", "e1")
        expect(manager.query).toHaveBeenCalledWith(RELEASE_EVENT, ["audit.append", "e1"])
    })
})
