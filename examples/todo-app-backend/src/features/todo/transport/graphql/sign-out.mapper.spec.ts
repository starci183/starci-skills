import { toSignOutRequest, toSignOutType } from "./sign-out.mapper"

describe("sign-out mapper", () => {
    it("maps the input to the request and the confirmation to the type", () => {
        expect(toSignOutRequest({ sessionToken: "token-1" })).toEqual({ sessionToken: "token-1" })
        expect(toSignOutType({ signedOut: true })).toEqual({ signedOut: true })
    })
})
