import { EnvSource } from "@modules/platform/config"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"

describe("HTTP security configuration", () => {
    it("allows local HTTP origins by default in development", () => {
        expect(
            parseHttpSecurityConfig(new EnvSource({ HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000" }))
                .allowedOrigins,
        ).toEqual(["http://localhost:3000"])
    })

    it("allows HTTP origins in test mode", () => {
        expect(
            parseHttpSecurityConfig(
                new EnvSource({ NODE_ENV: "test", HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000" }),
            ).allowHttpOrigins,
        ).toBe(true)
    })

    it("trims production origins and disables HTTP origins", () => {
        const options = parseHttpSecurityConfig(
            new EnvSource({ NODE_ENV: "production", HTTP_SECURITY_ALLOWED_ORIGINS: " https://web.example " }),
        )
        expect(options.allowHttpOrigins).toBe(false)
        expect(options.allowedOrigins).toEqual(["https://web.example"])
    })

    it.each(["production", "staging"])("rejects HTTP origins in %s", (mode) => {
        expect(() =>
            parseHttpSecurityConfig(
                new EnvSource({ NODE_ENV: mode, HTTP_SECURITY_ALLOWED_ORIGINS: "http://web.example" }),
            ),
        ).toThrow(expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }))
    })

    it("rejects an empty entry after a trailing comma", () => {
        expect(() =>
            parseHttpSecurityConfig(new EnvSource({ HTTP_SECURITY_ALLOWED_ORIGINS: "https://web.example," })),
        ).toThrow(expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }))
    })
})
