import { mock } from "@starci/jest-preset/mock"
import type { SessionService } from "@modules/domain/session"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { PurgeLapsedSessionsCommand } from "./purge-lapsed-sessions.command"
import { PurgeLapsedSessionsHandler } from "./purge-lapsed-sessions.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("PurgeLapsedSessionsHandler", () => {
    it("purges the sessions that lapsed by the tick inside a transaction and answers how many went", async () => {
        const inner = mockEntityManager()
        const sessions = mock<SessionService>({ purgeLapsed: jest.fn().mockResolvedValue(3) })
        const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
        const handler = new PurgeLapsedSessionsHandler(mock<Logger>(), entityManager, sessions)
        const result = await handler.execute(new PurgeLapsedSessionsCommand({ request: { at: AT } }))
        expect(result).toEqual({ purged: 3 })
        expect(sessions.purgeLapsed).toHaveBeenCalledWith({ manager: inner, at: AT })
        expect(entityManager.transaction).toHaveBeenCalledTimes(1)
    })

    it("answers zero when nothing had lapsed", async () => {
        const sessions = mock<SessionService>({ purgeLapsed: jest.fn().mockResolvedValue(0) })
        const entityManager = mockEntityManager({ transaction: fakeTransaction(mockEntityManager()) })
        const handler = new PurgeLapsedSessionsHandler(mock<Logger>(), entityManager, sessions)
        await expect(handler.execute(new PurgeLapsedSessionsCommand({ request: { at: AT } }))).resolves.toEqual({ purged: 0 })
    })
})
