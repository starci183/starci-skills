import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KeycloakAdminErrorCode } from "./errors/keycloak-admin.error"
import { KeycloakAdminClient } from "./keycloak-admin.client"
import { KEYCLOAK_ADMIN_OPTIONS } from "./keycloak-admin.decorators"
import { KeycloakAdminLogEvent } from "./keycloak-admin.log-events"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"
import { KeycloakAdminTokenService } from "./keycloak-admin-token.service"

const options: KeycloakAdminOptions = {
    url: "http://keycloak.test",
    realm: "shop realm",
    clientId: "identity-admin",
    clientSecret: new Secret("client-secret"),
    timeoutMs: 3000,
}

const params = { email: "buyer+one@example.test", password: "secret-password" }

const build = async () => {
    const http = mock<HttpClient>()
    const logger = mock<Logger>()
    const tokens = mock<KeycloakAdminTokenService>()
    tokens.accessToken.mockResolvedValue("admin-token")
    const moduleRef = await Test.createTestingModule({
        providers: [
            KeycloakAdminClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: KEYCLOAK_ADMIN_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
            { provide: KeycloakAdminTokenService, useValue: tokens },
        ],
    }).compile()
    return { client: moduleRef.get(KeycloakAdminClient), http, logger, tokens }
}

describe("KeycloakAdminClient", () => {
    describe("createMember", () => {
        it("creates the enabled realm user, finds its subject and returns it", async () => {
            const { client, http } = await build()
            http.request
                .mockResolvedValueOnce({ status: 201, body: undefined })
                .mockResolvedValueOnce({ status: 200, body: [{ id: "person-1" }] })

            await expect(client.createMember(params)).resolves.toEqual({ kind: "ok", value: { id: "person-1" } })

            expect(http.request).toHaveBeenNthCalledWith(1, {
                method: "POST",
                url: "http://keycloak.test/admin/realms/shop%20realm/users",
                headers: { authorization: "Bearer admin-token" },
                body: {
                    username: params.email,
                    email: params.email,
                    enabled: true,
                    emailVerified: true,
                    credentials: [{ type: "password", value: params.password, temporary: false }],
                },
                timeoutMs: 3000,
            })
            expect(http.request).toHaveBeenNthCalledWith(2, {
                method: "GET",
                url: "http://keycloak.test/admin/realms/shop%20realm/users?email=buyer%2Bone%40example.test&exact=true",
                headers: { authorization: "Bearer admin-token" },
                timeoutMs: 3000,
            })
        })

        it("returns unavailable without calling the API when no service token is available", async () => {
            const { client, http, tokens } = await build()
            tokens.accessToken.mockResolvedValue(null)

            await expect(client.createMember(params)).resolves.toMatchObject({
                kind: "refused",
                code: KeycloakAdminErrorCode.Unavailable,
            })

            expect(http.request).not.toHaveBeenCalled()
        })

        it("maps an existing email to the declared refusal", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 409, body: undefined })

            await expect(client.createMember(params)).resolves.toMatchObject({
                kind: "refused",
                code: KeycloakAdminErrorCode.EmailTaken,
            })
        })

        it("maps an unexpected create status to unavailable", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue({ status: 500, body: undefined })

            await expect(client.createMember(params)).resolves.toMatchObject({
                kind: "refused",
                code: KeycloakAdminErrorCode.Unavailable,
            })
        })

        it.each([
            ["a failed search", { status: 503, body: [{ id: "person-1" }] }],
            ["a non-array body", { status: 200, body: { id: "person-1" } }],
            ["an empty result", { status: 200, body: [] }],
            ["a non-string id", { status: 200, body: [{ id: 1 }] }],
        ])("maps %s after creation to unavailable", async (_case, found) => {
            const { client, http } = await build()
            http.request.mockResolvedValueOnce({ status: 201, body: undefined }).mockResolvedValueOnce(found)

            await expect(client.createMember(params)).resolves.toMatchObject({
                kind: "refused",
                code: KeycloakAdminErrorCode.Unavailable,
            })
        })

        it("maps a missing token for the follow-up search to unavailable", async () => {
            const { client, http, tokens } = await build()
            tokens.accessToken.mockResolvedValueOnce("admin-token").mockResolvedValueOnce(null)
            http.request.mockResolvedValue({ status: 201, body: undefined })

            await expect(client.createMember(params)).resolves.toMatchObject({
                kind: "refused",
                code: KeycloakAdminErrorCode.Unavailable,
            })

            expect(http.request).toHaveBeenCalledTimes(1)
        })

        it("forgets a token refused by Keycloak", async () => {
            const { client, http, tokens } = await build()
            http.request.mockResolvedValue({ status: 401, body: undefined })

            await expect(client.createMember(params)).resolves.toMatchObject({
                kind: "refused",
                code: KeycloakAdminErrorCode.Unavailable,
            })

            expect(tokens.forget).toHaveBeenCalledTimes(1)
        })

        it("logs a failed request and maps it to unavailable", async () => {
            const { client, http, logger } = await build()
            const failure = new Error("connection refused")
            http.request.mockRejectedValue(failure)

            await expect(client.createMember(params)).resolves.toMatchObject({
                kind: "refused",
                code: KeycloakAdminErrorCode.Unavailable,
            })

            expect(logger.error).toHaveBeenCalledWith(KeycloakAdminLogEvent.RequestFailed, failure, { path: "users" })
        })
    })
})
