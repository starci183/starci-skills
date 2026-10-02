import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { KeycloakErrorCode } from "./errors/keycloak.error"
import { KeycloakClient } from "./keycloak.client"
import { KEYCLOAK_OPTIONS } from "./keycloak.decorators"
import type { KeycloakOptions } from "./keycloak.options"

const options: KeycloakOptions = {
    tokenUrl: "http://keycloak.test/realms/shop/protocol/openid-connect/token",
    clientId: "storefront",
    timeoutMs: 3000,
}

const accessToken = (claims: unknown): string =>
    ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".")

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KeycloakClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: KEYCLOAK_OPTIONS, useValue: options },
        ],
    }).compile()
    return { client: moduleRef.get(KeycloakClient), http }
}

describe("KeycloakClient", () => {
    describe("signIn", () => {
        it("sends the password grant and returns the subject and refresh token", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { access_token: accessToken({ sub: "person-1" }), refresh_token: "refresh-token" },
            })

            await expect(client.signIn({ email: "buyer@example.test", password: "password" })).resolves.toEqual({
                subject: "person-1",
                refreshToken: "refresh-token",
            })

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: options.tokenUrl,
                form: {
                    grant_type: "password",
                    client_id: "storefront",
                    username: "buyer@example.test",
                    password: "password",
                },
                timeoutMs: 3000,
            })
        })

        it.each([199, 300, 401])("maps a %i response to invalid credentials", async (status) => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status, body: {} })

            await expect(client.signIn({ email: "buyer@example.test", password: "wrong" })).rejects.toMatchObject({
                code: KeycloakErrorCode.InvalidCredentials,
            })
        })

        it("maps a successful response without a readable subject to invalid credentials", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { access_token: accessToken({}), refresh_token: "refresh-token" },
            })

            await expect(client.signIn({ email: "buyer@example.test", password: "password" })).rejects.toMatchObject({
                code: KeycloakErrorCode.InvalidCredentials,
            })
        })

        it("maps a successful response without a refresh token to invalid credentials", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({
                status: 200,
                body: { access_token: accessToken({ sub: "person-1" }) },
            })

            await expect(client.signIn({ email: "buyer@example.test", password: "password" })).rejects.toMatchObject({
                code: KeycloakErrorCode.InvalidCredentials,
            })
        })

        it("maps an HTTP transport failure to provider unavailable", async () => {
            const { client, http } = await build()
            const failure = new HttpError({ code: HttpErrorCode.Timeout })
            http.request.mockRejectedValue(failure)

            await expect(client.signIn({ email: "buyer@example.test", password: "password" })).rejects.toMatchObject({
                code: KeycloakErrorCode.ProviderUnavailable,
                cause: failure,
            })
        })

        it("does not replace an unexpected programming failure", async () => {
            const { client, http } = await build()
            const failure = new Error("unexpected failure")
            http.request.mockRejectedValue(failure)

            await expect(client.signIn({ email: "buyer@example.test", password: "password" })).rejects.toBe(failure)
        })
    })

    describe("notifySignOut", () => {
        it("posts the refresh token to the realm logout endpoint", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 204, body: undefined })

            await client.notifySignOut({ refreshToken: "refresh-token" })

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "http://keycloak.test/realms/shop/protocol/openid-connect/logout",
                form: { client_id: "storefront", refresh_token: "refresh-token" },
                timeoutMs: 3000,
            })
        })

        it("does not fail when the provider says the session already ended", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 400, body: { error: "invalid_grant" } })

            await expect(client.notifySignOut({ refreshToken: "expired-token" })).resolves.toBeUndefined()
        })
    })
})
