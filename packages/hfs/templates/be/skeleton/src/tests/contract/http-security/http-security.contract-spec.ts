import { EnvSource } from "@modules/platform/config"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"

describe("HTTP security environment contract", () => {
    it("defaults to development and permits a local HTTP origin", () => {
        const config = parseHttpSecurityConfig(
            new EnvSource({ HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000" }),
        )
        expect(config.allowedOrigins).toEqual(["http://localhost:3000"])
        expect(config.allowHttpOrigins).toBe(true)
        expect(config.rateLimit).toEqual({ windowMs: 60_000, defaultLimit: 600, strictLimit: 30 })
        expect(config.webhooks).toEqual({})
    })

    it.each(["development", "test"])("permits HTTP origins in %s", (mode) => {
        const config = parseHttpSecurityConfig(
            new EnvSource({ NODE_ENV: mode, HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000" }),
        )
        expect(config.allowedOrigins).toEqual(["http://localhost:3000"])
        expect(config.allowHttpOrigins).toBe(true)
    })

    it("trims production HTTPS origins and reads declared rate tunables", () => {
        const config = parseHttpSecurityConfig(
            new EnvSource({
                NODE_ENV: "production",
                HTTP_SECURITY_ALLOWED_ORIGINS: " https://web.example , https://admin.example:8443 ",
                HTTP_SECURITY_RATE_WINDOW: "2s",
                HTTP_SECURITY_RATE_DEFAULT_LIMIT: "100",
                HTTP_SECURITY_RATE_STRICT_LIMIT: "10",
            }),
        )
        expect(config.allowedOrigins).toEqual(["https://web.example", "https://admin.example:8443"])
        expect(config.allowHttpOrigins).toBe(false)
        expect(config.rateLimit).toEqual({ windowMs: 2_000, defaultLimit: 100, strictLimit: 10 })
    })

    it.each(["production", "staging"])("rejects HTTP origins in %s", (mode) => {
        expect(() =>
            parseHttpSecurityConfig(
                new EnvSource({
                    NODE_ENV: mode,
                    HTTP_SECURITY_ALLOWED_ORIGINS: "http://web.example",
                }),
            ),
        ).toThrow("HTTP_SECURITY_REQUEST_INVALID")
    })

    it("rejects an empty allowlist entry after a comma", () => {
        expect(() =>
            parseHttpSecurityConfig(new EnvSource({ HTTP_SECURITY_ALLOWED_ORIGINS: "https://web.example," })),
        ).toThrow("HTTP_SECURITY_REQUEST_INVALID")
    })
})
