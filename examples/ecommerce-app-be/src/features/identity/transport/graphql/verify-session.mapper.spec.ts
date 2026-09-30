import { toVerifySessionRequest, toVerifySessionType } from "./verify-session.mapper"

describe("verifySession mapper", () => {
    it("maps the input to the request and the session to the type", () => {
        expect(toVerifySessionRequest({ sessionToken: "tok" })).toEqual({ sessionToken: "tok" })
        expect(toVerifySessionType({ personId: "p-1" })).toEqual({ personId: "p-1" })
    })
})
