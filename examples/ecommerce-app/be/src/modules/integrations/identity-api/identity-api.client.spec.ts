import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { IdentityApiErrorCode } from "./errors/identity-api.error"
import { IdentityApiClient } from "./identity-api.client"
import { IDENTITY_API_DOCUMENTS } from "./identity-api.contracts"
import { MODULE_OPTIONS_TOKEN } from "./identity-api.module-definition"
import type { IdentityApiOptions } from "./identity-api.options"

const options: IdentityApiOptions = { url: "http://identity.test", timeoutMs: 3000 }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            IdentityApiClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: MODULE_OPTIONS_TOKEN, useValue: options },
        ],
    }).compile()
    return { client: moduleRef.get(IdentityApiClient), http }
}

describe("IdentityApiClient", () => {
    describe("verify", () => {
        it("asks the identity GraphQL door and returns the verified session", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { data: { verifySession: { personId: "person-1" } } },
            })

            await expect(client.verify("session-token")).resolves.toEqual({ personId: "person-1" })

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "http://identity.test/graphql",
                headers: undefined,
                body: {
                    query: IDENTITY_API_DOCUMENTS.verifySession,
                    variables: { input: { sessionToken: "session-token" } },
                },
                timeoutMs: 3000,
            })
        })

        it("answers null when the service declares the session invalid", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { errors: [{ extensions: { code: "SESSION_INVALID" } }] },
            })

            await expect(client.verify("expired-token")).resolves.toBeNull()
        })

        it("maps other GraphQL refusals to unavailable and keeps all codes as the reason", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: {
                    errors: [{ extensions: { code: "INTERNAL" } }, { extensions: { code: "RATE_LIMITED" } }],
                },
            })

            await expect(client.verify("session-token")).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
                params: { reason: "INTERNAL,RATE_LIMITED" },
            })
        })

        it.each([
            ["a non-GraphQL body", "not-json-object"],
            ["missing data", {}],
            ["a missing session", { data: {} }],
            ["a non-object session", { data: { verifySession: "person-1" } }],
            ["a non-string person id", { data: { verifySession: { personId: 1 } } }],
        ])("reports contract mismatch for %s", async (_case, body) => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 200, body })

            await expect(client.verify("session-token")).rejects.toMatchObject({
                code: IdentityApiErrorCode.ContractMismatch,
            })
        })

        it("maps a transport failure to unavailable", async () => {
            const { client, http } = await build()
            const failure = new Error("identity timed out")
            http.request.mockRejectedValue(failure)

            await expect(client.verify("session-token")).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
                cause: failure,
            })
        })
    })

    describe("check", () => {
        it("reports the identity dependency name and accepts a healthy answer", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 200, body: undefined })

            await expect(client.check()).resolves.toBeUndefined()

            expect(client.name).toBe("identity")
            expect(http.request).toHaveBeenCalledWith({
                method: "GET",
                url: "http://identity.test/health",
                timeoutMs: 3000,
            })
        })

        it("maps an unhealthy status to unavailable without replacing its details", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 503, body: undefined })

            await expect(client.check()).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
                params: { status: 503 },
            })
        })

        it("maps a health transport failure to unavailable", async () => {
            const { client, http } = await build()
            const failure = new Error("connection refused")
            http.request.mockRejectedValue(failure)

            await expect(client.check()).rejects.toMatchObject({
                code: IdentityApiErrorCode.Unavailable,
                cause: failure,
            })
        })
    })
})
