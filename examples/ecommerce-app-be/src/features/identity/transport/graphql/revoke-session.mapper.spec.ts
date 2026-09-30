import { toRevokeSessionRequest, toRevokeSessionType } from "./revoke-session.mapper"

describe("revokeSession mapper", () => {
    it("maps the input to the request and the confirmation to the type", () => {
        expect(toRevokeSessionRequest({ sessionToken: "tok" })).toEqual({ sessionToken: "tok" })
        expect(toRevokeSessionType({ revoked: true })).toEqual({ revoked: true })
    })
})
