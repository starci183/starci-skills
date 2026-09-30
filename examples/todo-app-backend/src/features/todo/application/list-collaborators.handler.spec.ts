import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { InvitationService, InvitationView } from "@modules/domain/share"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ListCollaboratorsHandler } from "./list-collaborators.handler"
import { ListCollaboratorsQuery } from "./list-collaborators.query"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const view: InvitationView = {
    id: "i1",
    taskId: "t1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "accepted",
    sentAt: AT,
    acceptedAt: AT,
    revokedAt: null,
    personId: "ann",
}

describe("ListCollaboratorsHandler", () => {
    it("asks the share capability as the caller at the stamped instant and projects the invitations", async () => {
        const invitations = mock<InvitationService>({ listFor: jest.fn().mockResolvedValue([view]) })
        const handler = new ListCollaboratorsHandler(mock<Logger>(), new FakeClock(AT), invitations)
        const result = await handler.execute(new ListCollaboratorsQuery({ request: { taskId: "t1" }, principal }))
        expect(invitations.listFor).toHaveBeenCalledWith({ actorId: "owner-1", taskId: "t1", at: AT })
        expect(result).toEqual({
            collaborators: [{ invitationId: "i1", email: "ann@example.com", role: "editor", status: "accepted" }],
        })
    })

    it("answers an empty list for a stranger", async () => {
        const invitations = mock<InvitationService>({ listFor: jest.fn().mockResolvedValue([]) })
        const handler = new ListCollaboratorsHandler(mock<Logger>(), new FakeClock(AT), invitations)
        const result = await handler.execute(
            new ListCollaboratorsQuery({ request: { taskId: "t1" }, principal: { id: "stranger", roles: ["member"] } }),
        )
        expect(result).toEqual({ collaborators: [] })
    })
})
