import { mock } from "@starci/jest-preset/mock"
import { HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { KeycloakError, KeycloakErrorCode } from "./errors/keycloak.error"
import { KeycloakClient } from "./keycloak.client"

const OPTIONS = { tokenUrl: "http://keycloak.test/realms/todo/protocol/openid-connect/token", clientId: "todo-api", timeoutMs: 250 }

const tokenWith = (claims: object): string => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`

const answering = (status: number, body: unknown): HttpClient =>
    mock<HttpClient>({ request: jest.fn().mockResolvedValue({ status, body }) })

const failing = (cause: unknown): HttpClient => mock<HttpClient>({ request: jest.fn().mockRejectedValue(cause) })

const CREDENTIALS = { email: "person@example.com", password: "s3cret" }

describe("KeycloakClient", () => {
    describe("signIn", () => {
        it("posts the direct access grant as form fields with the client id and the deadline and answers the subject", async () => {
            const http = answering(200, { access_token: tokenWith({ sub: "person-1" }) })
            await expect(new KeycloakClient(http, OPTIONS).signIn(CREDENTIALS)).resolves.toEqual({ subject: "person-1" })
            expect(http.request).toHaveBeenCalledTimes(1)
            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: OPTIONS.tokenUrl,
                form: { grant_type: "password", client_id: "todo-api", username: "person@example.com", password: "s3cret" },
                timeoutMs: 250,
            })
        })

        it("refuses every error answer of the token endpoint with the same invalid-credentials error", async () => {
            for (const status of [400, 401, 403]) {
                const call = new KeycloakClient(answering(status, { error: "invalid_grant" }), OPTIONS).signIn(CREDENTIALS)
                await expect(call).rejects.toBeInstanceOf(KeycloakError)
                await expect(call).rejects.toMatchObject({ code: KeycloakErrorCode.InvalidCredentials })
            }
        })

        it("refuses a 200 answer that carries no readable subject", async () => {
            for (const body of [{ token_type: "bearer" }, { access_token: "no-segments" }, { access_token: tokenWith({ name: "x" }) }]) {
                await expect(new KeycloakClient(answering(200, body), OPTIONS).signIn(CREDENTIALS)).rejects.toMatchObject({
                    code: KeycloakErrorCode.InvalidCredentials,
                })
            }
        })

        it("reports an unreachable provider as unavailable, keeping the cause, and not as bad credentials", async () => {
            const cause = new HttpError({ code: HttpErrorCode.Network })
            const call = new KeycloakClient(failing(cause), OPTIONS).signIn(CREDENTIALS)
            await expect(call).rejects.toMatchObject({ code: KeycloakErrorCode.ProviderUnavailable, cause })
        })

        it("lets a failure that is not an HTTP failure through untouched", async () => {
            const cause = new TypeError("bug")
            await expect(new KeycloakClient(failing(cause), OPTIONS).signIn(CREDENTIALS)).rejects.toBe(cause)
        })
    })

    describe("notifySignOut", () => {
        it("posts the sign-out notice for the person with the deadline", async () => {
            const http = answering(200, undefined)
            await expect(new KeycloakClient(http, OPTIONS).notifySignOut({ personId: "person-1" })).resolves.toBeUndefined()
            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: OPTIONS.tokenUrl,
                body: { action: "sign-out", personId: "person-1" },
                timeoutMs: 250,
            })
        })

        it("is best-effort on an error answer: the provider refusing the notice does not fail the call", async () => {
            const http = answering(500, { error: "server_error" })
            await expect(new KeycloakClient(http, OPTIONS).notifySignOut({ personId: "person-1" })).resolves.toBeUndefined()
        })

        it("still fails as unavailable when the call itself cannot complete", async () => {
            const http = failing(new HttpError({ code: HttpErrorCode.Timeout }))
            await expect(new KeycloakClient(http, OPTIONS).notifySignOut({ personId: "person-1" })).rejects.toMatchObject({
                code: KeycloakErrorCode.ProviderUnavailable,
            })
        })
    })
})
