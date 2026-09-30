import { toSignInRequest, toSignInType } from "./sign-in.mapper"

describe("sign-in mapper", () => {
    it("maps the input to the request and the opened session to the type", () => {
        expect(toSignInRequest({ email: "person@example.com", password: "s3cret" })).toEqual({
            email: "person@example.com",
            password: "s3cret",
        })
        expect(toSignInType({ sessionToken: "token-1", personId: "person-1" })).toEqual({
            sessionToken: "token-1",
            personId: "person-1",
        })
    })
})
