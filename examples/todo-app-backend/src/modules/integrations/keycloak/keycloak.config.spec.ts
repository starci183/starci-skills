import { EnvSource } from "@modules/platform/config"
import { parseKeycloakConfig } from "./keycloak.config"

const REQUIRED = { KEYCLOAK_TOKEN_URL: "http://idp.test/token", KEYCLOAK_CLIENT_ID: "todo-api" }

describe("parseKeycloakConfig", () => {
    it("reads the endpoint and the client id and defaults the timeout to ten seconds", () => {
        expect(parseKeycloakConfig(new EnvSource(REQUIRED))).toEqual({
            tokenUrl: "http://idp.test/token",
            clientId: "todo-api",
            timeoutMs: 10_000,
        })
    })

    it("reads the timeout as a duration", () => {
        expect(parseKeycloakConfig(new EnvSource({ ...REQUIRED, KEYCLOAK_TIMEOUT: "3s" })).timeoutMs).toBe(3000)
    })

    it("has no default endpoint and no default client id", () => {
        expect(() => parseKeycloakConfig(new EnvSource({ KEYCLOAK_CLIENT_ID: "todo-api" }))).toThrow()
        expect(() => parseKeycloakConfig(new EnvSource({ KEYCLOAK_TOKEN_URL: "http://idp.test/token" }))).toThrow()
    })

    it("refuses an endpoint that is not a URL", () => {
        expect(() => parseKeycloakConfig(new EnvSource({ ...REQUIRED, KEYCLOAK_TOKEN_URL: "not a url" }))).toThrow()
    })
})
