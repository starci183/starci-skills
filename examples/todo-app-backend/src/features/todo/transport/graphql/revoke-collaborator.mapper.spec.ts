import { toRevokeCollaboratorRequest, toRevokeCollaboratorType } from "./revoke-collaborator.mapper"

describe("revoke-collaborator mapper", () => {
    it("maps the input to the request and the revoked invitation to the type", () => {
        expect(toRevokeCollaboratorRequest({ invitationId: "i1" })).toEqual({ invitationId: "i1" })
        expect(toRevokeCollaboratorType({ invitationId: "i1", status: "revoked" })).toEqual({
            invitationId: "i1",
            status: "revoked",
        })
    })
})
