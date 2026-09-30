import { mockEntityManager } from "@tests/fixtures/database"
import { SessionErrorCode } from "./errors/session.error"
import { SessionEntity } from "./persistence/entities/session.entity"
import { PURGE_LAPSED_SESSIONS } from "./persistence/session.sql"
import { SessionService } from "./session.service"

const AT = new Date("2026-09-30T10:00:00.000Z")
const OPTIONS = { ttlDays: 2, adminSubjects: ["boss"] }

const row = (expiresAt: Date): SessionEntity => ({
    token: "t1",
    personId: "p1",
    issuedAt: new Date("2026-09-29T10:00:00.000Z"),
    expiresAt,
})

describe("SessionService", () => {
    it("opens a session that lives for the configured days and saves it through the manager it was given", async () => {
        const own = mockEntityManager()
        const inTransaction = mockEntityManager({ save: jest.fn().mockImplementation((_target: unknown, entity: object) => entity) })
        const session = await new SessionService(own, OPTIONS).open({ manager: inTransaction, personId: "p1", at: AT })
        expect(session.personId).toBe("p1")
        expect(session.issuedAt).toEqual(AT)
        expect(session.expiresAt).toEqual(new Date("2026-10-02T10:00:00.000Z"))
        expect(session.token).toEqual(expect.any(String))
        expect(inTransaction.save).toHaveBeenCalledWith(SessionEntity, expect.objectContaining({ personId: "p1" }))
        expect(own.save).not.toHaveBeenCalled()
    })

    it("refuses an empty token before it queries anything", async () => {
        const manager = mockEntityManager()
        const outcome = await new SessionService(manager, OPTIONS).find({ token: "", at: AT })
        expect(outcome).toEqual({ kind: "refused", code: SessionErrorCode.NotFound, params: { reason: "missing-token" } })
        expect(manager.findOneBy).not.toHaveBeenCalled()
    })

    it("refuses an unknown token", async () => {
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
        const outcome = await new SessionService(manager, OPTIONS).find({ token: "t1", at: AT })
        expect(outcome).toMatchObject({ kind: "refused", code: SessionErrorCode.NotFound })
    })

    it("refuses a lapsed session as expired", async () => {
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(row(AT)) })
        const outcome = await new SessionService(manager, OPTIONS).find({ token: "t1", at: AT })
        expect(outcome).toMatchObject({ kind: "refused", code: SessionErrorCode.Expired })
    })

    it("answers the view of a live session", async () => {
        const later = new Date("2026-10-01T10:00:00.000Z")
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(row(later)) })
        const outcome = await new SessionService(manager, OPTIONS).find({ token: "t1", at: AT })
        expect(outcome).toEqual({
            kind: "ok",
            value: { token: "t1", personId: "p1", issuedAt: new Date("2026-09-29T10:00:00.000Z"), expiresAt: later },
        })
    })

    it("revokes by token through the caller manager", async () => {
        const inTransaction = mockEntityManager({ delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }) })
        await new SessionService(mockEntityManager(), OPTIONS).revoke({ manager: inTransaction, token: "t1" })
        expect(inTransaction.delete).toHaveBeenCalledWith(SessionEntity, "t1")
    })

    it("purges lapsed sessions and answers how many went", async () => {
        const inTransaction = mockEntityManager({ query: jest.fn().mockResolvedValue([[{ token: "a" }, { token: "b" }], 2]) })
        const count = await new SessionService(mockEntityManager(), OPTIONS).purgeLapsed({ manager: inTransaction, at: AT })
        expect(count).toBe(2)
        expect(inTransaction.query).toHaveBeenCalledWith(PURGE_LAPSED_SESSIONS, [AT])
    })

    it("gives an administrator the admin role and everyone else only member", () => {
        const service = new SessionService(mockEntityManager(), OPTIONS)
        expect(service.principalOf("boss")).toEqual({ id: "boss", roles: ["member", "admin"] })
        expect(service.principalOf("p1")).toEqual({ id: "p1", roles: ["member"] })
    })
})
