import type { INestApplication } from "@nestjs/common"
import type { Express, NextFunction, Request, Response } from "express"
import { mock } from "@starci/jest-preset"
import { EnvSource } from "@modules/platform/config"
import { applyHttpSecurity, securityHeaders, validateAllowedOrigins } from "./edge-security.service"
import { parseHttpSecurityConfig } from "./http-security.config"

describe("HTTP edge security", () => {
    it("keeps exact HTTPS origins and permits HTTP only in development and test", () => {
        expect(validateAllowedOrigins(["https://web.example", "https://admin.example:8443"], false)).toEqual([
            "https://web.example",
            "https://admin.example:8443",
        ])
        expect(
            parseHttpSecurityConfig(new EnvSource({ HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000" }))
                .allowedOrigins,
        ).toEqual(["http://localhost:3000"])
        expect(
            parseHttpSecurityConfig(
                new EnvSource({ NODE_ENV: "test", HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:3000" }),
            ).allowHttpOrigins,
        ).toBe(true)
        expect(
            parseHttpSecurityConfig(
                new EnvSource({ NODE_ENV: "production", HTTP_SECURITY_ALLOWED_ORIGINS: " https://web.example " }),
            ).allowHttpOrigins,
        ).toBe(false)
    })

    it.each([
        "*",
        "https://*.example",
        "https://web.example/",
        "https://web.example/path",
        "https://user:pass@web.example",
        "https://web.example?query=1",
        "https://web.example#hash",
        "not-an-origin",
        "",
        "ftp://web.example",
    ])("rejects wildcard, malformed and non-origin allowlist entry %s at boot", (origin) => {
        expect(() => validateAllowedOrigins([origin], true)).toThrow(
            expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }),
        )
    })

    it("rejects an empty allowlist and production HTTP origins", () => {
        expect(() => validateAllowedOrigins([], false)).toThrow(
            expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }),
        )
        expect(() =>
            parseHttpSecurityConfig(
                new EnvSource({ NODE_ENV: "production", HTTP_SECURITY_ALLOWED_ORIGINS: "http://web.example" }),
            ),
        ).toThrow(expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }))
        expect(() =>
            parseHttpSecurityConfig(
                new EnvSource({ NODE_ENV: "staging", HTTP_SECURITY_ALLOWED_ORIGINS: "http://web.example" }),
            ),
        ).toThrow(expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }))
        expect(() =>
            parseHttpSecurityConfig(new EnvSource({ HTTP_SECURITY_ALLOWED_ORIGINS: "https://web.example," })),
        ).toThrow(expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }))
    })

    it("sets every API security header and continues the request", () => {
        const response = mock<Response>()
        const next: jest.MockedFunction<NextFunction> = jest.fn()
        securityHeaders(mock<Request>(), response, next)
        expect(response.setHeader.mock.calls).toEqual([
            ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
            ["X-Content-Type-Options", "nosniff"],
            ["X-Frame-Options", "DENY"],
            ["Referrer-Policy", "no-referrer"],
            ["Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"],
        ])
        expect(next).toHaveBeenCalledTimes(1)
    })

    const appWithServer = () => {
        const server = mock<Express>()
        const adapter = mock<ReturnType<INestApplication["getHttpAdapter"]>>()
        adapter.getInstance.mockReturnValue(server)
        const app = mock<INestApplication>()
        app.getHttpAdapter.mockReturnValue(adapter)
        return { app, server }
    }

    it("installs headers before CORS, removes x-powered-by and trusts the declared ingress hop count", () => {
        const { app, server } = appWithServer()
        const options = parseHttpSecurityConfig(
            new EnvSource({ NODE_ENV: "production", HTTP_SECURITY_ALLOWED_ORIGINS: "https://web.example" }),
        )
        applyHttpSecurity(app, options, { trustProxy: 1 })
        expect(server.disable).toHaveBeenCalledWith("x-powered-by")
        expect(server.set).toHaveBeenCalledWith("trust proxy", 1)
        expect(app.use).toHaveBeenCalledWith(securityHeaders)
        expect(app.enableCors).toHaveBeenCalledWith({ origin: ["https://web.example"] })
        expect(app.use.mock.invocationCallOrder[0]).toBeLessThan(app.enableCors.mock.invocationCallOrder[0]!)
    })

    it("defaults manually supplied options to HTTPS and accepts explicit zero proxy hops", () => {
        const { app, server } = appWithServer()
        const options = {
            allowedOrigins: ["https://web.example"],
            rateLimit: { windowMs: 1, defaultLimit: 1, strictLimit: 1 },
            webhooks: {},
        }
        applyHttpSecurity(app, options, { trustProxy: 0 })
        expect(server.set).toHaveBeenCalledWith("trust proxy", 0)
        expect(() =>
            applyHttpSecurity(app, { ...options, allowedOrigins: ["http://web.example"] }, { trustProxy: 1 }),
        ).toThrow()
    })

    it.each([-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe proxy hop count %s", (trustProxy) => {
        const { app } = appWithServer()
        const options = parseHttpSecurityConfig(new EnvSource({ HTTP_SECURITY_ALLOWED_ORIGINS: "https://web.example" }))
        expect(() => applyHttpSecurity(app, options, { trustProxy })).toThrow(
            expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }),
        )
        expect(app.enableCors).not.toHaveBeenCalled()
    })
})
