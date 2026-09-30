import { mock } from "@starci/jest-preset/mock"
import type { HttpClient } from "@modules/platform/http"
import { IdentityApiErrorCode } from "./errors/identity-api.error"
import { IdentityApiClient } from "./identity-api.client"

const options = { url: "http://identity.test", timeoutMs: 250 }

const answering = (body: unknown, status = 200): HttpClient =>
    mock<HttpClient>({ request: jest.fn().mockResolvedValue({ status, body }) })

const clientFor = (http: HttpClient): IdentityApiClient => new IdentityApiClient(http, options)

describe("IdentityApiClient", () => {
    describe("verify", () => {
        it("posts the verifySession operation with the token and its deadline and names the person", async () => {
            const http = answering({ data: { verifySession: { personId: "p-1" } } })
            await expect(clientFor(http).verify("tok")).resolves.toEqual({ personId: "p-1" })
            expect(http.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: "POST",
                    url: "http://identity.test/graphql",
                    body: expect.objectContaining({ variables: { input: { sessionToken: "tok" } } }),
                    timeoutMs: 250,
                }),
            )
        })

        it("answers null when identity refuses the token with SESSION_INVALID", async () => {
            const http = answering({ errors: [{ message: "x", extensions: { code: "SESSION_INVALID" } }] })
            await expect(clientFor(http).verify("dead")).resolves.toBeNull()
        })

        it("fails as unavailable when identity reports another error, such as a rate limit", async () => {
            const http = answering({ errors: [{ message: "x", extensions: { code: "HTTP_SECURITY_RATE_LIMITED" } }] })
            await expect(clientFor(http).verify("tok")).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
            })
        })

        it("fails as a contract mismatch when the body has no session data", async () => {
            await expect(clientFor(answering({ data: {} })).verify("tok")).rejects.toMatchObject({
                code: IdentityApiErrorCode.ContractMismatch,
            })
            await expect(clientFor(answering("<html>")).verify("tok")).rejects.toMatchObject({
                code: IdentityApiErrorCode.ContractMismatch,
            })
        })

        it("fails as unavailable, keeping the cause, when the call itself fails", async () => {
            const cause = new TypeError("timed out")
            const http = mock<HttpClient>({ request: jest.fn().mockRejectedValue(cause) })
            await expect(clientFor(http).verify("tok")).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
                cause,
            })
        })
    })

    describe("check", () => {
        it("resolves when identity answers /health with 200", async () => {
            const http = answering({ status: "ok" })
            await expect(clientFor(http).check()).resolves.toBeUndefined()
            expect(http.request).toHaveBeenCalledWith({
                method: "GET",
                url: "http://identity.test/health",
                timeoutMs: 250,
            })
        })

        it("fails as unavailable on another status and when the call fails", async () => {
            await expect(clientFor(answering({}, 503)).check()).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
            })
            const http = mock<HttpClient>({ request: jest.fn().mockRejectedValue(new TypeError("fetch failed")) })
            await expect(clientFor(http).check()).rejects.toMatchObject({ code: IdentityApiErrorCode.Unavailable })
        })
    })
})
