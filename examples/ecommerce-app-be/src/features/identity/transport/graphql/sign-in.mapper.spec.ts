import { toSignInRequest, toSignInType } from "./sign-in.mapper"

describe("signIn mapper", () => {
    it("maps the input to the request and the session to the type", () => {
        expect(toSignInRequest({ email: "a@example.com", password: "pw" })).toEqual({
            email: "a@example.com",
            password: "pw",
        })
        expect(toSignInType({ sessionToken: "tok", personId: "p-1" })).toEqual({ sessionToken: "tok", personId: "p-1" })
    })
})
