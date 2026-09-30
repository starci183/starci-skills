import { toAcceptInvitationRequest, toAcceptInvitationType } from "./accept-invitation.mapper"

describe("accept-invitation mapper", () => {
    it("maps the input to the request and the accepted invitation to the type", () => {
        expect(toAcceptInvitationRequest({ invitationId: "i1", email: "ann@example.com" })).toEqual({
            invitationId: "i1",
            email: "ann@example.com",
        })
        expect(toAcceptInvitationType({ invitationId: "i1", role: "editor", status: "accepted" })).toEqual({
            invitationId: "i1",
            role: "editor",
            status: "accepted",
        })
    })
})
