import { Test } from "@nestjs/testing"
import { readRefreshToken, readSubject } from "./keycloak-token.policy"

const accessToken = (claims: unknown): string =>
    ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".")

const functions = { readRefreshToken, readSubject }
const SUBJECT: unique symbol = Symbol("integrations/keycloak/keycloak-token.policy")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readRefreshToken, readSubject } }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("readSubject", () => {
    it("reads the non-empty subject from the access-token payload", async () => {
        const subject = await build()
        expect(subject.readSubject({ access_token: accessToken({ sub: "person-1" }) })).toBe("person-1")
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
    ])("answers null for %s", async (_case, body) => {
        const subject = await build()
        expect(subject.readSubject(body)).toBeNull()
    })
})

describe("readRefreshToken", () => {
    it("returns a non-empty refresh token", async () => {
        const subject = await build()
        expect(subject.readRefreshToken({ refresh_token: "refresh-token" })).toBe("refresh-token")
    })

    it.each([
        ["a non-object response", null],
        ["a missing refresh token", {}],
        ["a non-string refresh token", { refresh_token: 1 }],
        ["an empty refresh token", { refresh_token: "" }],
    ])("answers null for %s", async (_case, body) => {
        const subject = await build()
        expect(subject.readRefreshToken(body)).toBeNull()
    })
})
