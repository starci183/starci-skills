import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KEYCLOAK_ADMIN_OPTIONS } from "./keycloak-admin.decorators"
import { KeycloakAdminLogEvent } from "./keycloak-admin.log-events"
import type { KeycloakAdminOptions } from "./keycloak-admin.options"
import { KeycloakAdminTokenService } from "./keycloak-admin-token.service"

const options = builder<KeycloakAdminOptions>({
    url: "http://keycloak.test",
    realm: "shop realm",
    clientId: "identity-admin",
    clientSecret: new Secret("client-secret"),
    timeoutMs: 3000,
})()

const granted = (token: string, expiresIn = 300) => ({
    status: 200,
    body: { access_token: token, expires_in: expiresIn },
})

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const http = mock<HttpClient>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KeycloakAdminTokenService,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: CLOCK, useValue: clock },
            { provide: KEYCLOAK_ADMIN_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(KeycloakAdminTokenService), clock, http, logger }
}

describe("KeycloakAdminTokenService", () => {
    describe("accessToken", () => {
        it("asks the realm token endpoint with the client-credentials grant of the confidential client", async () => {
            const { service, http } = await build()
            http.request.mockResolvedValue(granted("token-1"))

            await expect(service.accessToken()).resolves.toBe("token-1")

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "http://keycloak.test/realms/shop%20realm/protocol/openid-connect/token",
                form: { grant_type: "client_credentials", client_id: "identity-admin", client_secret: "client-secret" },
                timeoutMs: 3000,
            })
        })

        it("keeps the token until thirty seconds before it expires, then asks for a new one", async () => {
            const { service, clock, http } = await build()
            http.request.mockResolvedValueOnce(granted("token-1", 300)).mockResolvedValueOnce(granted("token-2", 300))

            await service.accessToken()
            clock.advance(269_000)
            await expect(service.accessToken()).resolves.toBe("token-1")
            clock.advance(1_000)
            await expect(service.accessToken()).resolves.toBe("token-2")

            expect(http.request).toHaveBeenCalledTimes(2)
        })

        it("asks again after the token was forgotten", async () => {
            const { service, http } = await build()
            http.request.mockResolvedValueOnce(granted("token-1")).mockResolvedValueOnce(granted("token-2"))

            await service.accessToken()
            service.forget()

            await expect(service.accessToken()).resolves.toBe("token-2")
        })

        it.each([
            ["a refused grant", { status: 401, body: { error: "unauthorized_client" } }],
            ["an answer without a token", { status: 200, body: { expires_in: 300 } }],
            ["an answer without an expiry", { status: 200, body: { access_token: "t" } }],
            ["an answer that is not an object", { status: 200, body: "token" }],
        ])("answers null and logs the status on %s", async (_case, answer) => {
            const { service, http, logger } = await build()
            http.request.mockResolvedValue(answer)

            await expect(service.accessToken()).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(KeycloakAdminLogEvent.TokenRefused, { status: answer.status })
        })

        it("answers null and logs the cause when the token endpoint cannot be reached, then tries again on the next call", async () => {
            const { service, http, logger } = await build()
            const failure = new Error("connection refused")
            http.request.mockRejectedValueOnce(failure).mockResolvedValueOnce(granted("token-1"))

            await expect(service.accessToken()).resolves.toBeNull()
            expect(logger.error).toHaveBeenCalledWith(KeycloakAdminLogEvent.TokenRefused, failure)

            await expect(service.accessToken()).resolves.toBe("token-1")
        })
    })
})
