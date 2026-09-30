import type { InvitationEntity } from "./entities/invitation.entity"
import { toInvitationView } from "./invitation.rows"

const SENT = new Date("2026-09-01T10:00:00.000Z")
const row: InvitationEntity = {
    id: "i1",
    taskId: "t1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "viewer",
    status: "pending",
    sentAt: SENT,
    acceptedAt: null,
    revokedAt: null,
    personId: null,
}

describe("invitation rows mapper", () => {
    it("copies the row and reads the status at the given instant", () => {
        expect(toInvitationView(row, SENT)).toEqual(row)
        expect(toInvitationView(row, new Date("2026-10-01T10:00:00.000Z")).status).toBe("expired")
    })
})
