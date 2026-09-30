import { toInviteRequest, toInviteType } from "./invite.mapper"

describe("invite mapper", () => {
    it("maps the input to the request and the created invitation to the type", () => {
        expect(toInviteRequest({ taskId: "t1", email: "ann@example.com", role: "editor" })).toEqual({
            taskId: "t1",
            email: "ann@example.com",
            role: "editor",
        })
        const invitation = { invitationId: "i1", taskId: "t1", email: "ann@example.com", role: "editor", status: "pending" }
        expect(toInviteType(invitation)).toEqual(invitation)
    })
})
