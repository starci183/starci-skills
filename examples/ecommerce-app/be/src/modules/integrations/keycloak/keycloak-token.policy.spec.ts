import { readRefreshToken, readSubject } from "./keycloak-token.policy"

const accessToken = (claims: unknown): string =>
    ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".")

describe("readSubject", () => {
    it("reads the non-empty subject from the access-token payload", () => {
        expect(readSubject({ access_token: accessToken({ sub: "person-1" }) })).toBe("person-1")
    })

    it.each([
        ["a non-object response", null],
        ["a missing access token", {}],
        ["a non-string access token", { access_token: 1 }],
        ["a token without a payload", { access_token: "opaque-token" }],
        ["a payload that is not JSON", { access_token: "header.@@@.signature" }],
        ["non-object claims", { access_token: accessToken(["person-1"]) }],
        ["claims without a subject", { access_token: accessToken({}) }],
        ["a non-string subject", { access_token: accessToken({ sub: 1 }) }],
        ["an empty subject", { access_token: accessToken({ sub: "" }) }],
    ])("answers null for %s", (_case, body) => {
        expect(readSubject(body)).toBeNull()
    })
})

describe("readRefreshToken", () => {
    it("returns a non-empty refresh token", () => {
        expect(readRefreshToken({ refresh_token: "refresh-token" })).toBe("refresh-token")
    })

    it.each([
        ["a non-object response", null],
        ["a missing refresh token", {}],
        ["a non-string refresh token", { refresh_token: 1 }],
        ["an empty refresh token", { refresh_token: "" }],
    ])("answers null for %s", (_case, body) => {
        expect(readRefreshToken(body)).toBeNull()
    })
})
