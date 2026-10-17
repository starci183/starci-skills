import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Express, NextFunction, Request, Response } from "express"
import { mock } from "@starci/jest-preset"
import { applyHttpSecurity, securityHeaders, validateAllowedOrigins } from "./edge-security.service"
import type { HttpSecurityOptions } from "./http-security.options"

const HTTP_EDGE = Symbol("HTTP_EDGE")

const buildEdge = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: HTTP_EDGE, useValue: { applyHttpSecurity, securityHeaders, validateAllowedOrigins } }],
    }).compile()
    return moduleRef.get<typeof import("./edge-security.service")>(HTTP_EDGE)
}

const options: HttpSecurityOptions = {
    allowedOrigins: ["https://web.example"],
    rateLimit: { windowMs: 1, defaultLimit: 1, strictLimit: 1 },
    webhooks: {},
}

const appWithServer = () => {
    const server = mock<Express>()
    const adapter = mock<ReturnType<INestApplication["getHttpAdapter"]>>()
    adapter.getInstance.mockReturnValue(server)
    const app = mock<INestApplication>()
    app.getHttpAdapter.mockReturnValue(adapter)
    return { app, server }
}

describe("HTTP edge origin validation", () => {
    it("keeps exact HTTPS origins and admits HTTP only when explicitly enabled", async () => {
        const edge = await buildEdge()
        expect(edge.validateAllowedOrigins(["https://web.example", "https://admin.example:8443"], false)).toEqual([
            "https://web.example",
            "https://admin.example:8443",
        ])
        expect(edge.validateAllowedOrigins(["http://localhost:3000"], true)).toEqual(["http://localhost:3000"])
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
    ])("rejects wildcard, malformed and non-origin allowlist entry %s at boot", async (origin) => {
        const edge = await buildEdge()
        expect(() => edge.validateAllowedOrigins([origin], true)).toThrow(
            expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }),
        )
    })

    it("rejects an empty allowlist and HTTP origins without development permission", async () => {
        const edge = await buildEdge()
        expect(() => edge.validateAllowedOrigins([], false)).toThrow(
            expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }),
        )
        expect(() => edge.validateAllowedOrigins(["http://web.example"], false)).toThrow(
            expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }),
        )
    })
})

describe("HTTP edge installation", () => {
    it("sets every API security header and continues the request", async () => {
        const edge = await buildEdge()
        const response = mock<Response>()
        const next: jest.MockedFunction<NextFunction> = jest.fn()
        edge.securityHeaders(mock<Request>(), response, next)
        expect(response.setHeader.mock.calls).toEqual([
            ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
            ["X-Content-Type-Options", "nosniff"],
            ["X-Frame-Options", "DENY"],
            ["Referrer-Policy", "no-referrer"],
            ["Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"],
        ])
        expect(next).toHaveBeenCalledTimes(1)
    })

    it("installs headers before CORS, removes x-powered-by and trusts the declared ingress hop count", async () => {
        const edge = await buildEdge()
        const { app, server } = appWithServer()
        edge.applyHttpSecurity(app, { ...options, allowHttpOrigins: false }, { trustProxy: 1 })
        expect(server.disable).toHaveBeenCalledWith("x-powered-by")
        expect(server.set).toHaveBeenCalledWith("trust proxy", 1)
        expect(app.use).toHaveBeenCalledWith(edge.securityHeaders)
        expect(app.enableCors).toHaveBeenCalledWith({ origin: ["https://web.example"] })
        expect(app.use.mock.invocationCallOrder[0]).toBeLessThan(app.enableCors.mock.invocationCallOrder[0] ?? 0)
    })

    it("defaults manually supplied options to HTTPS and accepts explicit zero proxy hops", async () => {
        const edge = await buildEdge()
        const { app, server } = appWithServer()
        edge.applyHttpSecurity(app, options, { trustProxy: 0 })
        expect(server.set).toHaveBeenCalledWith("trust proxy", 0)
        expect(() =>
            edge.applyHttpSecurity(app, { ...options, allowedOrigins: ["http://web.example"] }, { trustProxy: 1 }),
        ).toThrow()
    })

    it("admits development HTTP origins when explicitly enabled", async () => {
        const edge = await buildEdge()
        const { app } = appWithServer()
        edge.applyHttpSecurity(
            app,
            { ...options, allowedOrigins: ["http://localhost:3000"], allowHttpOrigins: true },
            { trustProxy: 1 },
        )
        expect(app.enableCors).toHaveBeenCalledWith({ origin: ["http://localhost:3000"] })
    })

    it.each([-1, 0.5, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
        "rejects unsafe proxy hop count %s",
        async (trustProxy) => {
            const edge = await buildEdge()
            const { app } = appWithServer()
            expect(() => edge.applyHttpSecurity(app, options, { trustProxy })).toThrow(
                expect.objectContaining({ code: "HTTP_SECURITY_REQUEST_INVALID" }),
            )
            expect(app.enableCors).not.toHaveBeenCalled()
        },
    )
})
