import { readSubject } from "./keycloak-token.policy"

const tokenWith = (payload: string): string => `e30.${Buffer.from(payload).toString("base64url")}.sig`

describe("readSubject", () => {
    it("reads the subject out of the payload segment of the access token", () => {
        expect(readSubject({ access_token: tokenWith(JSON.stringify({ sub: "person-1" })) })).toBe("person-1")
    })

    it("answers null when the body carries no access token", () => {
        expect(readSubject({ token_type: "bearer" })).toBeNull()
        expect(readSubject({ access_token: 12 })).toBeNull()
        expect(readSubject(undefined)).toBeNull()
        expect(readSubject("<html>")).toBeNull()
    })

    it("answers null when the token has no payload segment", () => {
        expect(readSubject({ access_token: "no-segments" })).toBeNull()
    })

    it("answers null when the payload is not JSON", () => {
        expect(readSubject({ access_token: tokenWith("not json") })).toBeNull()
    })

    it("answers null when the payload has no usable subject", () => {
        expect(readSubject({ access_token: tokenWith(JSON.stringify({ name: "x" })) })).toBeNull()
        expect(readSubject({ access_token: tokenWith(JSON.stringify({ sub: "" })) })).toBeNull()
        expect(readSubject({ access_token: tokenWith(JSON.stringify({ sub: 7 })) })).toBeNull()
        expect(readSubject({ access_token: tokenWith("null") })).toBeNull()
        expect(readSubject({ access_token: tokenWith(JSON.stringify(["person-1"])) })).toBeNull()
    })
})
