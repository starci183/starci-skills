import type { SessionEntity } from "./entities/session.entity"
import { toSessionView } from "./session.rows"

const AT = new Date("2026-09-30T10:00:00.000Z")
const LATER = new Date("2026-09-30T11:00:00.000Z")

describe("session rows mapper", () => {
    it("copies a session row into the view", () => {
        const row: SessionEntity = { token: "t1", personId: "p1", issuedAt: AT, expiresAt: LATER }
        expect(toSessionView(row)).toEqual(row)
    })
})
